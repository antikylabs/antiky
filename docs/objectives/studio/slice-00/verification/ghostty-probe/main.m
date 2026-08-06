#import <AppKit/AppKit.h>
#import <dispatch/dispatch.h>
#import <ghostty.h>

@interface ProbeView : NSView
@end

@implementation ProbeView
- (BOOL)acceptsFirstResponder {
  return YES;
}
@end

static ghostty_config_t probe_config = NULL;
static ghostty_app_t probe_app = NULL;
static ghostty_surface_t probe_surface = NULL;
static NSWindow *probe_window = nil;
static ProbeView *probe_view = nil;
static BOOL probe_finished = NO;
static BOOL probe_focused = NO;
static BOOL probe_clipped = NO;
static BOOL probe_resized = NO;
static BOOL probe_child_exit_action = NO;
static BOOL probe_process_exited = NO;
static BOOL probe_renderer_healthy = NO;
static BOOL probe_renderer_layer_attached = NO;
static BOOL probe_unicode_input = NO;
static uint32_t probe_child_exit_code = UINT32_MAX;
static uint64_t probe_child_runtime_ms = 0;
static uint32_t probe_expected_initial_width = 0;
static uint32_t probe_expected_initial_height = 0;
static uint32_t probe_expected_final_width = 0;
static uint32_t probe_expected_final_height = 0;
static ghostty_surface_size_s probe_initial_size;
static ghostty_surface_size_s probe_final_size;

static void finish_probe(BOOL timed_out);
static void wait_for_surface_size(BOOL final_size, NSUInteger attempt);

static BOOL surface_contains_input_marker(void) {
  if (probe_surface == NULL) {
    return NO;
  }

  ghostty_selection_s selection = {
      .top_left = {
          .tag = GHOSTTY_POINT_SCREEN,
          .coord = GHOSTTY_POINT_COORD_TOP_LEFT,
          .x = 0,
          .y = 0,
      },
      .bottom_right = {
          .tag = GHOSTTY_POINT_SCREEN,
          .coord = GHOSTTY_POINT_COORD_BOTTOM_RIGHT,
          .x = UINT32_MAX,
          .y = UINT32_MAX,
      },
      .rectangle = false,
  };
  ghostty_text_s text = {0};
  if (!ghostty_surface_read_text(probe_surface, selection, &text)) {
    return NO;
  }

  NSString *terminal_text = [[NSString alloc]
      initWithBytes:text.text
             length:text.text_len
           encoding:NSUTF8StringEncoding];
  BOOL found = [terminal_text containsString:@"ANTIKY_INPUT_OK"];
  ghostty_surface_free_text(probe_surface, &text);
  return found;
}

static void probe_wakeup(void *userdata) {
  (void)userdata;
  dispatch_async(dispatch_get_main_queue(), ^{
    if (probe_app != NULL && !probe_finished) {
      ghostty_app_tick(probe_app);
    }
  });
}

static bool probe_action(
    ghostty_app_t app,
    ghostty_target_s target,
    ghostty_action_s action) {
  (void)app;

  if (action.tag == GHOSTTY_ACTION_RENDER &&
      target.tag == GHOSTTY_TARGET_SURFACE &&
      target.target.surface != NULL) {
    ghostty_surface_t surface = target.target.surface;
    dispatch_async(dispatch_get_main_queue(), ^{
      if (!probe_finished && surface == probe_surface) {
        ghostty_surface_draw(surface);
      }
    });
    return true;
  }

  if (action.tag == GHOSTTY_ACTION_RENDERER_HEALTH) {
    BOOL healthy =
        action.action.renderer_health == GHOSTTY_RENDERER_HEALTH_HEALTHY;
    dispatch_async(dispatch_get_main_queue(), ^{
      probe_renderer_healthy = healthy;
    });
    return true;
  }

  if (action.tag == GHOSTTY_ACTION_SHOW_CHILD_EXITED) {
    uint32_t exit_code = action.action.child_exited.exit_code;
    uint64_t runtime_ms = action.action.child_exited.timetime_ms;
    dispatch_async(dispatch_get_main_queue(), ^{
      probe_child_exit_action = YES;
      probe_child_exit_code = exit_code;
      probe_child_runtime_ms = runtime_ms;
      dispatch_after(
          dispatch_time(DISPATCH_TIME_NOW, 250 * NSEC_PER_MSEC),
          dispatch_get_main_queue(),
          ^{ finish_probe(NO); });
    });
    return true;
  }

  return true;
}

static bool probe_read_clipboard(
    void *userdata,
    ghostty_clipboard_e clipboard,
    void *request) {
  (void)userdata;
  (void)clipboard;
  (void)request;
  return false;
}

static void probe_confirm_read_clipboard(
    void *userdata,
    const char *text,
    void *request,
    ghostty_clipboard_request_e request_type) {
  (void)userdata;
  (void)text;
  (void)request;
  (void)request_type;
}

static void probe_write_clipboard(
    void *userdata,
    ghostty_clipboard_e clipboard,
    const ghostty_clipboard_content_s *content,
    size_t content_count,
    bool requires_confirmation) {
  (void)userdata;
  (void)clipboard;
  (void)content;
  (void)content_count;
  (void)requires_confirmation;
}

static void probe_close_surface(void *userdata, bool process_alive) {
  (void)userdata;
  (void)process_alive;
}

static void request_surface_size(
    NSSize size,
    uint32_t *expected_width,
    uint32_t *expected_height) {
  [probe_view setFrameSize:size];
  NSRect backing = [probe_view convertRectToBacking:NSMakeRect(0, 0, size.width, size.height)];
  *expected_width = (uint32_t)backing.size.width;
  *expected_height = (uint32_t)backing.size.height;
  ghostty_surface_set_size(
      probe_surface,
      *expected_width,
      *expected_height);
}

static void wait_for_surface_size(BOOL final_size, NSUInteger attempt) {
  if (probe_finished || probe_surface == NULL) {
    return;
  }

  ghostty_surface_size_s current = ghostty_surface_size(probe_surface);
  uint32_t expected_width = final_size
                                ? probe_expected_final_width
                                : probe_expected_initial_width;
  uint32_t expected_height = final_size
                                 ? probe_expected_final_height
                                 : probe_expected_initial_height;
  if (current.width_px == expected_width &&
      current.height_px == expected_height) {
    if (!final_size) {
      probe_initial_size = current;
      request_surface_size(
          NSMakeSize(760, 360),
          &probe_expected_final_width,
          &probe_expected_final_height);
      ghostty_surface_refresh(probe_surface);
      wait_for_surface_size(YES, 0);
      return;
    }

    probe_final_size = current;
    dispatch_after(
        dispatch_time(DISPATCH_TIME_NOW, 1 * NSEC_PER_SEC),
        dispatch_get_main_queue(),
        ^{
          if (probe_finished) {
            return;
          }
          const char *input = "Antiky ✓\n";
          ghostty_surface_text(probe_surface, input, strlen(input));
        });
    return;
  }

  if (attempt >= 200) {
    finish_probe(YES);
    return;
  }
  dispatch_after(
      dispatch_time(DISPATCH_TIME_NOW, 25 * NSEC_PER_MSEC),
      dispatch_get_main_queue(),
      ^{ wait_for_surface_size(final_size, attempt + 1); });
}

static void finish_probe(BOOL timed_out) {
  if (probe_finished) {
    return;
  }
  probe_finished = YES;

  if (probe_surface != NULL) {
    probe_process_exited = ghostty_surface_process_exited(probe_surface);
    probe_final_size = ghostty_surface_size(probe_surface);
    probe_unicode_input = surface_contains_input_marker();
  }

  probe_resized =
      probe_initial_size.width_px == probe_expected_initial_width &&
      probe_initial_size.height_px == probe_expected_initial_height &&
      probe_final_size.width_px == probe_expected_final_width &&
      probe_final_size.height_px == probe_expected_final_height &&
      probe_initial_size.width_px != probe_final_size.width_px &&
      probe_initial_size.height_px != probe_final_size.height_px;

  BOOL passed =
      !timed_out &&
      probe_surface != NULL &&
      probe_focused &&
      probe_clipped &&
      probe_renderer_layer_attached &&
      probe_resized &&
      probe_child_exit_action &&
      probe_process_exited &&
      probe_unicode_input &&
      probe_child_runtime_ms >= 7000;

  if (probe_surface != NULL) {
    ghostty_surface_set_focus(probe_surface, false);
    ghostty_surface_free(probe_surface);
    probe_surface = NULL;
  }
  if (probe_app != NULL) {
    ghostty_app_free(probe_app);
    probe_app = NULL;
  }
  if (probe_config != NULL) {
    ghostty_config_free(probe_config);
    probe_config = NULL;
  }
  [probe_window orderOut:nil];
  [probe_window close];

  fprintf(
      stdout,
      "{\"schemaVersion\":1,\"status\":\"%s\",\"focus\":%s,"
      "\"clipping\":%s,\"resize\":%s,\"unicodeInput\":%s,"
      "\"macosReportedExitCode\":%u,\"childRuntimeMs\":%llu,"
      "\"childExitAction\":%s,\"processExited\":%s,"
      "\"rendererLayerAttached\":%s,\"rendererHealthy\":%s,"
      "\"initialWidthPx\":%u,"
      "\"initialHeightPx\":%u,\"finalWidthPx\":%u,"
      "\"finalHeightPx\":%u,\"disposed\":true,\"timedOut\":%s}\n",
      passed ? "pass" : "fail",
      probe_focused ? "true" : "false",
      probe_clipped ? "true" : "false",
      probe_resized ? "true" : "false",
      probe_unicode_input ? "true" : "false",
      probe_child_exit_code,
      (unsigned long long)probe_child_runtime_ms,
      probe_child_exit_action ? "true" : "false",
      probe_process_exited ? "true" : "false",
      probe_renderer_layer_attached ? "true" : "false",
      probe_renderer_healthy ? "true" : "false",
      probe_initial_size.width_px,
      probe_initial_size.height_px,
      probe_final_size.width_px,
      probe_final_size.height_px,
      timed_out ? "true" : "false");
  fflush(stdout);

  [NSApp terminate:nil];
  if (!passed) {
    exit(1);
  }
}

int main(int argc, char **argv) {
  @autoreleasepool {
    if (ghostty_init((uintptr_t)argc, argv) != 0) {
      fprintf(stderr, "ghostty_init failed\n");
      return 1;
    }

    [NSApplication sharedApplication];
    [NSApp setActivationPolicy:NSApplicationActivationPolicyRegular];

    probe_config = ghostty_config_new();
    if (probe_config == NULL) {
      fprintf(stderr, "ghostty_config_new failed\n");
      return 1;
    }
    ghostty_config_finalize(probe_config);

    ghostty_runtime_config_s runtime = {
        .userdata = NULL,
        .supports_selection_clipboard = false,
        .wakeup_cb = probe_wakeup,
        .action_cb = probe_action,
        .read_clipboard_cb = probe_read_clipboard,
        .confirm_read_clipboard_cb = probe_confirm_read_clipboard,
        .write_clipboard_cb = probe_write_clipboard,
        .close_surface_cb = probe_close_surface,
    };
    probe_app = ghostty_app_new(&runtime, probe_config);
    if (probe_app == NULL) {
      fprintf(stderr, "ghostty_app_new failed\n");
      ghostty_config_free(probe_config);
      return 1;
    }

    NSRect window_frame = NSMakeRect(0, 0, 640, 320);
    probe_window = [[NSWindow alloc]
        initWithContentRect:window_frame
                  styleMask:NSWindowStyleMaskTitled | NSWindowStyleMaskClosable |
                            NSWindowStyleMaskResizable
                    backing:NSBackingStoreBuffered
                      defer:NO];
    probe_view = [[ProbeView alloc] initWithFrame:window_frame];
    [probe_window setContentView:probe_view];
    [probe_window setTitle:@"Antiky Ghostty Surface Probe"];
    [probe_window center];
    [probe_window makeKeyAndOrderFront:nil];
    [NSApp activateIgnoringOtherApps:YES];

    ghostty_surface_config_s surface_config = ghostty_surface_config_new();
    surface_config.platform_tag = GHOSTTY_PLATFORM_MACOS;
    surface_config.platform.macos.nsview = (__bridge void *)probe_view;
    surface_config.userdata = (__bridge void *)probe_view;
    surface_config.scale_factor = probe_window.backingScaleFactor;
    surface_config.font_size = 13;
    surface_config.working_directory = "/tmp";
    surface_config.command =
        "/bin/sh -c 'sleep 2; IFS= read -r value; "
        "if [ \"$value\" = \"Antiky ✓\" ]; then printf \"ANTIKY_INPUT_OK\\n\"; "
        "else printf \"ANTIKY_INPUT_FAIL\\n\"; fi; sleep 5'";
    surface_config.wait_after_command = true;
    surface_config.context = GHOSTTY_SURFACE_CONTEXT_WINDOW;

    probe_surface = ghostty_surface_new(probe_app, &surface_config);
    if (probe_surface == NULL) {
      fprintf(stderr, "ghostty_surface_new failed\n");
      ghostty_app_free(probe_app);
      ghostty_config_free(probe_config);
      return 1;
    }

    ghostty_app_set_focus(probe_app, true);
    probe_focused = [probe_window makeFirstResponder:probe_view] &&
                    probe_window.firstResponder == probe_view;
    ghostty_surface_set_focus(probe_surface, probe_focused);
    probe_clipped = probe_view.clipsToBounds;
    probe_renderer_layer_attached = probe_view.wantsLayer && probe_view.layer != nil;

    request_surface_size(
        NSMakeSize(640, 320),
        &probe_expected_initial_width,
        &probe_expected_initial_height);
    ghostty_surface_refresh(probe_surface);
    wait_for_surface_size(NO, 0);

    dispatch_after(
        dispatch_time(DISPATCH_TIME_NOW, 15 * NSEC_PER_SEC),
        dispatch_get_main_queue(),
        ^{ finish_probe(YES); });

    [NSApp run];
  }
  return 0;
}
