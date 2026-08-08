# Load the user's normal interactive setup, then keep Studio's prompt compact.
typeset -g ZDOTDIR="${ANTIKY_STUDIO_USER_ZDOTDIR:-$HOME}"
typeset -g HISTFILE="$ZDOTDIR/.zsh_history"
if [[ -r "$ZDOTDIR/.zshrc" ]]; then
  source "$ZDOTDIR/.zshrc"
fi

setopt PROMPT_PERCENT
function _antiky_studio_prompt {
  PROMPT='%% '
  RPROMPT=''
}
autoload -Uz add-zsh-hook
add-zsh-hook precmd _antiky_studio_prompt
_antiky_studio_prompt
unset ANTIKY_STUDIO_USER_ZDOTDIR
