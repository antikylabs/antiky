#ifndef ANTIKY_TERMINAL_BRIDGE_H
#define ANTIKY_TERMINAL_BRIDGE_H

#include <stdint.h>
#include <stddef.h>

typedef struct {
  uint8_t is_open;
  uint8_t process_exited;
  uint8_t renderer_healthy;
  uint16_t columns;
  uint16_t rows;
  uint32_t width_px;
  uint32_t height_px;
} antiky_terminal_status_s;

int32_t antiky_terminal_open(
    void *parent_view,
    const char *working_directory,
    const char *terminal_profile,
    double x,
    double y,
    double width,
    double height,
    char *error,
    size_t error_capacity);
int32_t antiky_terminal_layout(
    double x,
    double y,
    double width,
    double height,
    char *error,
    size_t error_capacity);
int32_t antiky_terminal_hide(char *error, size_t error_capacity);
int32_t antiky_terminal_focus(char *error, size_t error_capacity);
int32_t antiky_terminal_validate_profile(
    const char *terminal_profile,
    char *error,
    size_t error_capacity);
void antiky_terminal_close(void);
antiky_terminal_status_s antiky_terminal_status(void);

#endif
