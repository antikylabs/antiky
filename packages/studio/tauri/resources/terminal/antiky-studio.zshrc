printf '\033[3J\033[2J\033[H'
# Keep Studio startup isolated from identifying prompts, banners, and shell hooks.
typeset -g HISTFILE=/dev/null
setopt PROMPT_PERCENT
function _antiky_studio_prompt {
  PROMPT='%% '
  RPROMPT=''
}
autoload -Uz add-zsh-hook
add-zsh-hook precmd _antiky_studio_prompt
_antiky_studio_prompt
