#import "project_picker.h"

#import <AppKit/AppKit.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>
#import <stdlib.h>
#import <string.h>

char *antiky_project_picker_open(void) {
    @autoreleasepool {
        NSOpenPanel *panel = [NSOpenPanel openPanel];
        [panel setCanChooseFiles:YES];
        [panel setCanChooseDirectories:NO];
        [panel setAllowsMultipleSelection:NO];
        [panel setResolvesAliases:NO];
        if (@available(macOS 11.0, *)) {
            UTType *projectType = [UTType typeWithFilenameExtension:@"antiky"
                                                   conformingToType:UTTypeJSON];
            [panel setAllowedContentTypes:@[projectType]];
        } else {
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
            [panel setAllowedFileTypes:@[@"antiky"]];
#pragma clang diagnostic pop
        }
        [panel setTitle:@"Open an Antiky project"];
        [panel setPrompt:@"Open project"];

        if ([panel runModal] != NSModalResponseOK) {
            return NULL;
        }
        const char *path = [[[panel URL] path] fileSystemRepresentation];
        return path == NULL ? NULL : strdup(path);
    }
}

void antiky_project_picker_free(char *path) {
    free(path);
}
