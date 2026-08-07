This builds on @docs/objectives/studio/slice-00/feedback-06-demo-projects-plan.md and @docs/objectives/studio/slice-00/feedback-07-website-demo-artifacts-plan.md

Architecture decisions:

- [Framework 0020: Keep game code and game hosts in different modules](../../../adr/framework/0020-keep-game-code-and-game-hosts-in-different-modules_H.md)
- [CLI 0002: Supply CLI project services through a library API](../../../adr/cli/0002-supply-cli-project-services-through-a-library-api_H.md)
- [CLI 0003: Make CLI project services the development authority](../../../adr/cli/0003-make-cli-project-services-the-development-authority_H.md)
- [Studio 0006: Use CLI project services directly](../../../adr/studio/0006-use-cli-project-services-directly_H.md)

You should work on both of those and these until complete.

Games should not have to implement their own host code/server. They should be focused on game logic only.

Therefore demo folders and projects should be game logic typscript etc only, no serving/host/control systems like that.

A game dev's outcome should be a compiled and ready game script that mounts into any canvas.

The antiky dev cli and antiky studio should own a development host canvas etc.

Antiky studio shouldn't have to call cli commands to launch stuff, it should be able to use the antiky dev package directly to launch its own host etc (This way it's not waiting for a host to launch and then connect etc... its not waiting on the dev host...)

This invalidates and removes the need for the autostart development feedback plan.

AC:

1. [x] Complete these ADRs:
   - [Framework 0020](../../../adr/framework/0020-keep-game-code-and-game-hosts-in-different-modules_H.md)
   - [CLI 0002](../../../adr/cli/0002-supply-cli-project-services-through-a-library-api_H.md)
   - [CLI 0003](../../../adr/cli/0003-make-cli-project-services-the-development-authority_H.md)
   - [Studio 0006](../../../adr/studio/0006-use-cli-project-services-directly_H.md)
2. [x] Update CLI package with whatever it needs to be the authoritative game host during development for an antiky package.
3. [x] Update studio to use that game host, importing cli package code directly and executing it to get the live host running and mcps started etc so that its entire startup loop is controlled by the studio not by studio+dev-cli-calls-over-bash-etc...
4. [x] Update docs/objectives/studio/slice-00/feedback-06-demo-projects-plan.md and docs/objectives/studio/slice-00/feedback-07-website-demo-artifacts-plan.md as needed after AC 1,2,3 are done.
5. Work on docs/objectives/studio/slice-00/feedback-06-demo-projects-plan.md and docs/objectives/studio/slice-00/feedback-07-website-demo-artifacts-plan.md until complete.
