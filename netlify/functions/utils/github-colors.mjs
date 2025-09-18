// GitHub's official language colors
// Source: https://github.com/github/linguist/blob/master/lib/linguist/languages.yml
export const GITHUB_LANGUAGE_COLORS = {
  'JavaScript': '#f1e05a',
  'TypeScript': '#3178c6',
  'Python': '#3572A5',
  'Java': '#b07219',
  'C': '#555555',
  'C++': '#f34b7d',
  'C#': '#239120',
  'PHP': '#4F5D95',
  'Ruby': '#701516',
  'Go': '#00ADD8',
  'Rust': '#dea584',
  'Swift': '#ffac45',
  'Kotlin': '#A97BFF',
  'Scala': '#c22d40',
  'Clojure': '#db5855',
  'ClojureScript': '#db5855',
  'HTML': '#e34c26',
  'CSS': '#563d7c',
  'SCSS': '#c6538c',
  'Sass': '#a53b70',
  'Less': '#1d365d',
  'Vue': '#4FC08D',
  'Svelte': '#ff3e00',
  'React': '#61dafb',
  'Angular': '#dd1b16',
  'Shell': '#89e051',
  'PowerShell': '#012456',
  'Vim Script': '#199f4b',
  'Lua': '#000080',
  'Perl': '#0298c3',
  'R': '#198CE7',
  'MATLAB': '#e16737',
  'Objective-C': '#438eff',
  'Objective-C++': '#6866fb',
  'Dart': '#00B4AB',
  'Haskell': '#5e5086',
  'Erlang': '#B83998',
  'Elixir': '#6e4a7e',
  'F#': '#b845fc',
  'Visual Basic': '#945db7',
  'Assembly': '#6E4C13',
  'Makefile': '#427819',
  'Dockerfile': '#384d54',
  'YAML': '#cb171e',
  'JSON': '#292929',
  'XML': '#0060ac',
  'Markdown': '#083fa1',
  'reStructuredText': '#141414',
  'SQL': '#e38c00',
  'PLpgSQL': '#336790',
  'TOML': '#9c4221',
  'INI': '#d1dbe0',
  'Config': '#d1dbe0',
  'Environment': '#d1dbe0',
  'Gitignore': '#d1dbe0',
  'Gitattributes': '#d1dbe0',
  'EditorConfig': '#d1dbe0',
  'Text': '#d1dbe0',
  'Unknown': '#cccccc'
};

export function getLanguageColor(language) {
  return GITHUB_LANGUAGE_COLORS[language] || GITHUB_LANGUAGE_COLORS['Unknown'];
}

export function getLanguageColorWithOpacity(language, opacity = 1) {
  const hex = getLanguageColor(language);
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}