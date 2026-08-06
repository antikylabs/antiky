#import "terminal_bridge.h"

#import <AppKit/AppKit.h>
#import <QuartzCore/QuartzCore.h>
#import <dispatch/dispatch.h>
#import <ghostty.h>

@interface AntikyGhosttyView : NSView
@property(nonatomic, assign) ghostty_surface_t surface;
@property(nonatomic, assign) BOOL processExited;
@property(nonatomic, assign) BOOL rendererHealthy;
@end

static ghostty_config_t antiky_config = NULL;
static ghostty_app_t antiky_app = NULL;
static AntikyGhosttyView *antiky_view = nil;
static BOOL antiky_ghostty_initialized = NO;

static void write_error(char *destination, size_t capacity, const char *message) {
  if (destination == NULL || capacity == 0) return;
  snprintf(destination, capacity, "%s", message);
}

static ghostty_input_mods_e ghostty_mods(NSEventModifierFlags flags) {
  uint32_t mods = GHOSTTY_MODS_NONE;
  if ((flags & NSEventModifierFlagShift) != 0) mods |= GHOSTTY_MODS_SHIFT;
  if ((flags & NSEventModifierFlagControl) != 0) mods |= GHOSTTY_MODS_CTRL;
  if ((flags & NSEventModifierFlagOption) != 0) mods |= GHOSTTY_MODS_ALT;
  if ((flags & NSEventModifierFlagCommand) != 0) mods |= GHOSTTY_MODS_SUPER;
  if ((flags & NSEventModifierFlagCapsLock) != 0) mods |= GHOSTTY_MODS_CAPS;
  if ((flags & NX_DEVICERSHIFTKEYMASK) != 0) mods |= GHOSTTY_MODS_SHIFT_RIGHT;
  if ((flags & NX_DEVICERCTLKEYMASK) != 0) mods |= GHOSTTY_MODS_CTRL_RIGHT;
  if ((flags & NX_DEVICERALTKEYMASK) != 0) mods |= GHOSTTY_MODS_ALT_RIGHT;
  if ((flags & NX_DEVICERCMDKEYMASK) != 0) mods |= GHOSTTY_MODS_SUPER_RIGHT;
  return (ghostty_input_mods_e)mods;
}

static uint32_t single_codepoint(NSString *text) {
  if (text.length == 0) return 0;
  NSData *data = [text dataUsingEncoding:NSUTF32LittleEndianStringEncoding];
  if (data.length != sizeof(uint32_t)) return 0;
  uint32_t value = 0;
  [data getBytes:&value length:sizeof(value)];
  return value;
}

static NSString *event_text(NSEvent *event) {
  NSString *text = event.characters;
  uint32_t value = single_codepoint(text);
  if (value < 0x20 || (value >= 0xF700 && value <= 0xF8FF)) return nil;
  return text;
}

static NSString *unmodified_event_text(NSEvent *event) {
  if (@available(macOS 10.15, *)) {
    return [event charactersByApplyingModifiers:0];
  }
  return event.charactersIgnoringModifiers;
}

static BOOL send_key(NSEvent *event, ghostty_input_action_e action) {
  if (antiky_view.surface == NULL) return NO;
  ghostty_input_key_s key = {0};
  key.action = action;
  key.mods = ghostty_mods(event.modifierFlags);
  key.consumed_mods = ghostty_mods(
      event.modifierFlags & ~(NSEventModifierFlagControl | NSEventModifierFlagCommand));
  key.keycode = event.keyCode;
  key.unshifted_codepoint = single_codepoint(unmodified_event_text(event));
  NSString *text = action == GHOSTTY_ACTION_RELEASE ? nil : event_text(event);
  key.text = text.UTF8String;
  return ghostty_surface_key(antiky_view.surface, key);
}

static void send_mouse_position(NSEvent *event) {
  if (antiky_view.surface == NULL) return;
  NSPoint point = [antiky_view convertPoint:event.locationInWindow fromView:nil];
  ghostty_surface_mouse_pos(
      antiky_view.surface, point.x, point.y, ghostty_mods(event.modifierFlags));
}

static void send_mouse_button(
    NSEvent *event,
    ghostty_input_mouse_state_e state,
    ghostty_input_mouse_button_e button) {
  if (antiky_view.surface == NULL) return;
  send_mouse_position(event);
  ghostty_surface_mouse_button(
      antiky_view.surface, state, button, ghostty_mods(event.modifierFlags));
}

@implementation AntikyGhosttyView
- (BOOL)isFlipped { return YES; }
- (BOOL)acceptsFirstResponder { return YES; }
- (BOOL)acceptsFirstMouse:(NSEvent *)event { (void)event; return YES; }
- (BOOL)becomeFirstResponder {
  if (self.surface != NULL) ghostty_surface_set_focus(self.surface, true);
  return YES;
}
- (BOOL)resignFirstResponder {
  if (self.surface != NULL) ghostty_surface_set_focus(self.surface, false);
  return YES;
}
- (BOOL)performKeyEquivalent:(NSEvent *)event {
  if (event.type != NSEventTypeKeyDown ||
      self.window.firstResponder != self ||
      self.surface == NULL) {
    return [super performKeyEquivalent:event];
  }
  NSEventModifierFlags flags = event.modifierFlags;
  if ((flags & NSEventModifierFlagControl) == 0 ||
      (flags & NSEventModifierFlagCommand) != 0) {
    return [super performKeyEquivalent:event];
  }
  ghostty_input_action_e action =
      event.isARepeat ? GHOSTTY_ACTION_REPEAT : GHOSTTY_ACTION_PRESS;
  send_key(event, action);
  return YES;
}
- (void)keyDown:(NSEvent *)event {
  send_key(event, event.isARepeat ? GHOSTTY_ACTION_REPEAT : GHOSTTY_ACTION_PRESS);
}
- (void)keyUp:(NSEvent *)event { send_key(event, GHOSTTY_ACTION_RELEASE); }
- (void)flagsChanged:(NSEvent *)event {
  uint32_t expected = 0;
  switch (event.keyCode) {
    case 0x39: expected = GHOSTTY_MODS_CAPS; break;
    case 0x38: case 0x3C: expected = GHOSTTY_MODS_SHIFT; break;
    case 0x3B: case 0x3E: expected = GHOSTTY_MODS_CTRL; break;
    case 0x3A: case 0x3D: expected = GHOSTTY_MODS_ALT; break;
    case 0x37: case 0x36: expected = GHOSTTY_MODS_SUPER; break;
    default: return;
  }
  ghostty_input_action_e action =
      (ghostty_mods(event.modifierFlags) & expected) != 0
          ? GHOSTTY_ACTION_PRESS
          : GHOSTTY_ACTION_RELEASE;
  send_key(event, action);
}
- (void)mouseDown:(NSEvent *)event {
  [self.window makeFirstResponder:self];
  send_mouse_button(event, GHOSTTY_MOUSE_PRESS, GHOSTTY_MOUSE_LEFT);
}
- (void)mouseUp:(NSEvent *)event {
  send_mouse_button(event, GHOSTTY_MOUSE_RELEASE, GHOSTTY_MOUSE_LEFT);
}
- (void)rightMouseDown:(NSEvent *)event {
  [self.window makeFirstResponder:self];
  send_mouse_button(event, GHOSTTY_MOUSE_PRESS, GHOSTTY_MOUSE_RIGHT);
}
- (void)rightMouseUp:(NSEvent *)event {
  send_mouse_button(event, GHOSTTY_MOUSE_RELEASE, GHOSTTY_MOUSE_RIGHT);
}
- (void)otherMouseDown:(NSEvent *)event {
  send_mouse_button(event, GHOSTTY_MOUSE_PRESS, GHOSTTY_MOUSE_MIDDLE);
}
- (void)otherMouseUp:(NSEvent *)event {
  send_mouse_button(event, GHOSTTY_MOUSE_RELEASE, GHOSTTY_MOUSE_MIDDLE);
}
- (void)mouseMoved:(NSEvent *)event { send_mouse_position(event); }
- (void)mouseDragged:(NSEvent *)event { send_mouse_position(event); }
- (void)rightMouseDragged:(NSEvent *)event { send_mouse_position(event); }
- (void)otherMouseDragged:(NSEvent *)event { send_mouse_position(event); }
- (void)scrollWheel:(NSEvent *)event {
  if (self.surface == NULL) return;
  double multiplier = event.hasPreciseScrollingDeltas ? 2.0 : 1.0;
  int mods = event.hasPreciseScrollingDeltas ? 1 : 0;
  ghostty_surface_mouse_scroll(
      self.surface,
      event.scrollingDeltaX * multiplier,
      event.scrollingDeltaY * multiplier,
      mods);
}
@end

static void runtime_wakeup(void *userdata) {
  (void)userdata;
  dispatch_async(dispatch_get_main_queue(), ^{
    if (antiky_app != NULL) ghostty_app_tick(antiky_app);
  });
}

static bool runtime_action(
    ghostty_app_t app, ghostty_target_s target, ghostty_action_s action) {
  (void)app;
  if (action.tag == GHOSTTY_ACTION_RENDER && target.tag == GHOSTTY_TARGET_SURFACE) {
    ghostty_surface_t surface = target.target.surface;
    dispatch_async(dispatch_get_main_queue(), ^{
      if (antiky_view != nil && antiky_view.surface == surface) ghostty_surface_draw(surface);
    });
  } else if (action.tag == GHOSTTY_ACTION_SHOW_CHILD_EXITED) {
    dispatch_async(dispatch_get_main_queue(), ^{
      if (antiky_view != nil) antiky_view.processExited = YES;
    });
  } else if (action.tag == GHOSTTY_ACTION_RENDERER_HEALTH) {
    BOOL healthy = action.action.renderer_health == GHOSTTY_RENDERER_HEALTH_HEALTHY;
    dispatch_async(dispatch_get_main_queue(), ^{
      if (antiky_view != nil) antiky_view.rendererHealthy = healthy;
    });
  }
  return true;
}

static bool runtime_read_clipboard(
    void *userdata, ghostty_clipboard_e location, void *request) {
  (void)userdata;
  if (location != GHOSTTY_CLIPBOARD_STANDARD || antiky_view.surface == NULL) return false;
  NSString *value = [NSPasteboard.generalPasteboard stringForType:NSPasteboardTypeString];
  if (value.length == 0) return false;
  ghostty_surface_complete_clipboard_request(
      antiky_view.surface, value.UTF8String, request, false);
  return true;
}

static void runtime_confirm_read_clipboard(
    void *userdata,
    const char *value,
    void *request,
    ghostty_clipboard_request_e type) {
  (void)userdata;
  (void)value;
  (void)type;
  if (antiky_view.surface != NULL) {
    ghostty_surface_complete_clipboard_request(antiky_view.surface, "", request, false);
  }
}

static void runtime_write_clipboard(
    void *userdata,
    ghostty_clipboard_e location,
    const ghostty_clipboard_content_s *content,
    size_t count,
    bool requires_confirmation) {
  (void)userdata;
  if (location != GHOSTTY_CLIPBOARD_STANDARD || requires_confirmation || content == NULL) return;
  for (size_t index = 0; index < count; index++) {
    if (content[index].mime != NULL && content[index].data != NULL &&
        strcmp(content[index].mime, "text/plain") == 0) {
      [NSPasteboard.generalPasteboard clearContents];
      NSString *value = [NSString stringWithUTF8String:content[index].data];
      if (value != nil) {
        [NSPasteboard.generalPasteboard setString:value forType:NSPasteboardTypeString];
      }
      return;
    }
  }
}

static void runtime_close_surface(void *userdata, bool process_alive) {
  (void)userdata;
  (void)process_alive;
  dispatch_async(dispatch_get_main_queue(), ^{
    if (antiky_view != nil) antiky_view.processExited = YES;
  });
}

static NSRect native_frame(NSView *parent, double x, double y, double width, double height) {
  if (parent.isFlipped) return NSMakeRect(x, y, width, height);
  return NSMakeRect(x, parent.bounds.size.height - y - height, width, height);
}

static void update_surface_geometry(void) {
  if (antiky_view.surface == NULL || antiky_view.window == nil) return;
  NSRect backing = [antiky_view convertRectToBacking:antiky_view.bounds];
  double x_scale = backing.size.width / antiky_view.bounds.size.width;
  double y_scale = backing.size.height / antiky_view.bounds.size.height;
  ghostty_surface_set_content_scale(antiky_view.surface, x_scale, y_scale);
  ghostty_surface_set_size(
      antiky_view.surface, (uint32_t)backing.size.width, (uint32_t)backing.size.height);
  antiky_view.layer.contentsScale = antiky_view.window.backingScaleFactor;
  ghostty_surface_refresh(antiky_view.surface);
}

int32_t antiky_terminal_open(
    void *parent_view,
    const char *working_directory,
    double x,
    double y,
    double width,
    double height,
    char *error,
    size_t error_capacity) {
  if (![NSThread isMainThread] || parent_view == NULL || working_directory == NULL) {
    write_error(error, error_capacity, "Native terminal must open on the main thread.");
    return 1;
  }
  if (antiky_view != nil) {
    return antiky_terminal_layout(x, y, width, height, error, error_capacity);
  }
  if (!antiky_ghostty_initialized) {
    char program[] = "antiky-studio";
    char *arguments[] = {program, NULL};
    if (ghostty_init(1, arguments) != 0) {
      write_error(error, error_capacity, "libghostty initialization failed.");
      return 1;
    }
    antiky_ghostty_initialized = YES;
  }

  antiky_config = ghostty_config_new();
  if (antiky_config == NULL) {
    write_error(error, error_capacity, "Ghostty configuration could not be created.");
    return 1;
  }
  ghostty_config_load_default_files(antiky_config);
  ghostty_config_load_recursive_files(antiky_config);
  ghostty_config_finalize(antiky_config);

  ghostty_runtime_config_s runtime = {
      .userdata = NULL,
      .supports_selection_clipboard = false,
      .wakeup_cb = runtime_wakeup,
      .action_cb = runtime_action,
      .read_clipboard_cb = runtime_read_clipboard,
      .confirm_read_clipboard_cb = runtime_confirm_read_clipboard,
      .write_clipboard_cb = runtime_write_clipboard,
      .close_surface_cb = runtime_close_surface,
  };
  antiky_app = ghostty_app_new(&runtime, antiky_config);
  if (antiky_app == NULL) {
    ghostty_config_free(antiky_config);
    antiky_config = NULL;
    write_error(error, error_capacity, "Ghostty application could not be created.");
    return 1;
  }

  NSView *parent = (__bridge NSView *)parent_view;
  antiky_view = [[AntikyGhosttyView alloc]
      initWithFrame:native_frame(parent, x, y, width, height)];
  antiky_view.wantsLayer = YES;
  antiky_view.clipsToBounds = YES;
  [parent addSubview:antiky_view positioned:NSWindowAbove relativeTo:nil];

  ghostty_surface_config_s surface_config = ghostty_surface_config_new();
  surface_config.platform_tag = GHOSTTY_PLATFORM_MACOS;
  surface_config.platform.macos.nsview = (__bridge void *)antiky_view;
  surface_config.userdata = (__bridge void *)antiky_view;
  surface_config.scale_factor = parent.window.backingScaleFactor;
  surface_config.font_size = 13;
  surface_config.working_directory = working_directory;
  surface_config.wait_after_command = true;
  surface_config.context = GHOSTTY_SURFACE_CONTEXT_WINDOW;
  antiky_view.surface = ghostty_surface_new(antiky_app, &surface_config);
  if (antiky_view.surface == NULL) {
    antiky_terminal_close();
    write_error(error, error_capacity, "Ghostty surface could not be created.");
    return 1;
  }
  ghostty_app_set_focus(antiky_app, NSApp.isActive);
  update_surface_geometry();
  return 0;
}

int32_t antiky_terminal_layout(
    double x,
    double y,
    double width,
    double height,
    char *error,
    size_t error_capacity) {
  if (![NSThread isMainThread] || antiky_view == nil || antiky_view.superview == nil) {
    write_error(error, error_capacity, "Native terminal is not open.");
    return 1;
  }
  antiky_view.frame = native_frame(antiky_view.superview, x, y, width, height);
  update_surface_geometry();
  return 0;
}

int32_t antiky_terminal_focus(char *error, size_t error_capacity) {
  if (![NSThread isMainThread] || antiky_view == nil || antiky_view.window == nil) {
    write_error(error, error_capacity, "Native terminal is not open.");
    return 1;
  }
  if (![antiky_view.window makeFirstResponder:antiky_view]) {
    write_error(error, error_capacity, "Native terminal could not receive focus.");
    return 1;
  }
  return 0;
}

void antiky_terminal_close(void) {
  if (![NSThread isMainThread]) return;
  ghostty_surface_t surface = antiky_view.surface;
  antiky_view.surface = NULL;
  [antiky_view removeFromSuperview];
  antiky_view = nil;
  if (surface != NULL) {
    ghostty_surface_set_focus(surface, false);
    // Direct teardown frees the surface. An interactive close calls back into this host.
    ghostty_surface_free(surface);
  }
  if (antiky_app != NULL) {
    ghostty_app_free(antiky_app);
    antiky_app = NULL;
  }
  if (antiky_config != NULL) {
    ghostty_config_free(antiky_config);
    antiky_config = NULL;
  }
}

antiky_terminal_status_s antiky_terminal_status(void) {
  antiky_terminal_status_s status = {0};
  if (antiky_view == nil || antiky_view.surface == NULL) return status;
  ghostty_surface_size_s size = ghostty_surface_size(antiky_view.surface);
  status.is_open = 1;
  status.process_exited = antiky_view.processExited ||
      ghostty_surface_process_exited(antiky_view.surface);
  status.renderer_healthy = antiky_view.rendererHealthy;
  status.columns = size.columns;
  status.rows = size.rows;
  status.width_px = size.width_px;
  status.height_px = size.height_px;
  return status;
}
