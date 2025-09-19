const LANGUAGE_EXTENSIONS = {
  // JavaScript/TypeScript
  'js': 'JavaScript',
  'jsx': 'JavaScript',
  'ts': 'TypeScript',
  'tsx': 'TypeScript',
  'mjs': 'JavaScript',
  'cjs': 'JavaScript',

  // Python
  'py': 'Python',
  'pyx': 'Python',
  'pyi': 'Python',
  'pyc': 'Python',

  // Java/JVM languages
  'java': 'Java',
  'kt': 'Kotlin',
  'kts': 'Kotlin',
  'scala': 'Scala',
  'clj': 'Clojure',
  'cljs': 'ClojureScript',

  // C/C++
  'c': 'C',
  'cpp': 'C++',
  'cc': 'C++',
  'cxx': 'C++',
  'c++': 'C++',
  'h': 'C/C++',
  'hpp': 'C++',
  'hxx': 'C++',

  // C#/.NET
  'cs': 'C#',
  'fs': 'F#',
  'vb': 'Visual Basic',

  // Web technologies
  'html': 'HTML',
  'htm': 'HTML',
  'css': 'CSS',
  'scss': 'SCSS',
  'sass': 'Sass',
  'less': 'Less',
  'vue': 'Vue',
  'svelte': 'Svelte',

  // PHP
  'php': 'PHP',
  'phtml': 'PHP',

  // Ruby
  'rb': 'Ruby',
  'rake': 'Ruby',

  // Go
  'go': 'Go',

  // Rust
  'rs': 'Rust',

  // Swift
  'swift': 'Swift',

  // R
  'r': 'R',
  'R': 'R',

  // Shell scripting
  'sh': 'Shell',
  'bash': 'Shell',
  'zsh': 'Shell',
  'fish': 'Shell',
  'ps1': 'PowerShell',

  // Database
  'sql': 'SQL',

  // Markup/Data
  'xml': 'XML',
  'json': 'JSON',
  'yaml': 'YAML',
  'yml': 'YAML',
  'toml': 'TOML',
  'md': 'Markdown',
  'mdx': 'Markdown',
  'rst': 'reStructuredText',

  // Config files
  'ini': 'INI',
  'cfg': 'Config',
  'conf': 'Config',
  'env': 'Environment',

  // Docker
  'dockerfile': 'Dockerfile',

  // Lua
  'lua': 'Lua',

  // Perl
  'pl': 'Perl',
  'pm': 'Perl',

  // Haskell
  'hs': 'Haskell',

  // Erlang/Elixir
  'erl': 'Erlang',
  'ex': 'Elixir',
  'exs': 'Elixir',

  // Dart
  'dart': 'Dart',

  // Vim
  'vim': 'Vim Script',

  // Objective-C
  'm': 'Objective-C',
  'mm': 'Objective-C++',

  // Modern systems languages
  'zig': 'Zig',
  'odin': 'Odin',
  'nim': 'Nim',
  'crystal': 'Crystal',
  'v': 'V',

  // Functional languages
  'ml': 'OCaml',
  'mli': 'OCaml',
  'fsx': 'F#',
  'elm': 'Elm',
  'purs': 'PureScript',
  'reason': 'Reason',
  're': 'Reason',

  // Assembly
  'asm': 'Assembly',
  's': 'Assembly',
  'S': 'Assembly',
  'nasm': 'Assembly',

  // Alternative web languages
  'coffee': 'CoffeeScript',
  'litcoffee': 'CoffeeScript',
  'ls': 'LiveScript',
  'pug': 'Pug',
  'jade': 'Pug',
  'haml': 'Haml',
  'slim': 'Slim',

  // Data science & math
  'jl': 'Julia',
  'mat': 'MATLAB',
  'm': 'MATLAB', // Note: conflicts with Objective-C, filename context needed
  'mathematica': 'Mathematica',
  'nb': 'Mathematica',

  // Game development
  'cs': 'C#', // Also Unity scripts
  'gd': 'GDScript',
  'gdscript': 'GDScript',

  // Mobile development
  'xaml': 'XAML',

  // Newer languages
  'move': 'Move',
  'sol': 'Solidity',
  'cairo': 'Cairo',

  // Domain-specific
  'tex': 'TeX',
  'bib': 'BibTeX',
  'graphql': 'GraphQL',
  'gql': 'GraphQL',
  'proto': 'Protocol Buffers',
  'thrift': 'Thrift',

  // Alternative scripting
  'nu': 'Nushell',
  'pwsh': 'PowerShell',
};

const SPECIAL_FILENAMES = {
  'dockerfile': 'Dockerfile',
  'makefile': 'Makefile',
  'rakefile': 'Ruby',
  'gemfile': 'Ruby',
  'podfile': 'Ruby',
  'fastfile': 'Ruby',
  'appfile': 'Ruby',
  'deliverfile': 'Ruby',
  'scanfile': 'Ruby',
  'snapfile': 'Ruby',
  'matchfile': 'Ruby',
  'gymfile': 'Ruby',
  'package.json': 'JSON',
  'package-lock.json': 'JSON',
  'yarn.lock': 'YAML',
  'cargo.toml': 'TOML',
  'cargo.lock': 'TOML',
  'go.mod': 'Go Module',
  'go.sum': 'Go Module',
  'requirements.txt': 'Text',
  'pipfile': 'TOML',
  'pipfile.lock': 'JSON',
  'poetry.lock': 'TOML',
  'pyproject.toml': 'TOML',
  'readme.md': 'Markdown',
  'readme.txt': 'Text',
  'readme': 'Text',
  'license': 'Text',
  'changelog.md': 'Markdown',
  'changelog': 'Text',
  '.gitignore': 'Gitignore',
  '.gitattributes': 'Gitattributes',
  '.editorconfig': 'EditorConfig',
  '.eslintrc': 'JSON',
  '.eslintrc.js': 'JavaScript',
  '.eslintrc.json': 'JSON',
  '.prettierrc': 'JSON',
  '.prettierrc.js': 'JavaScript',
  'tsconfig.json': 'JSON',
  'webpack.config.js': 'JavaScript',
  'rollup.config.js': 'JavaScript',
  'vite.config.js': 'JavaScript',
  'next.config.js': 'JavaScript',
  'nuxt.config.js': 'JavaScript',
};

export function detectLanguage(filename) {
  if (!filename) return 'Unknown';

  const lowerFilename = filename.toLowerCase();

  // Check special filenames first
  if (SPECIAL_FILENAMES[lowerFilename]) {
    return SPECIAL_FILENAMES[lowerFilename];
  }

  // Check for files without extensions but with special names
  const baseFilename = lowerFilename.split('/').pop();
  if (SPECIAL_FILENAMES[baseFilename]) {
    return SPECIAL_FILENAMES[baseFilename];
  }

  // Extract extension
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1) {
    return 'Unknown';
  }

  const extension = filename.slice(lastDotIndex + 1).toLowerCase();

  return LANGUAGE_EXTENSIONS[extension] || 'Unknown';
}

export function groupFilesByLanguage(files) {
  const languageGroups = {};

  files.forEach(file => {
    const language = detectLanguage(file.filename);

    if (!languageGroups[language]) {
      languageGroups[language] = {
        files: [],
        totalAdditions: 0,
        totalDeletions: 0,
        totalChanges: 0
      };
    }

    languageGroups[language].files.push(file);
    languageGroups[language].totalAdditions += file.additions || 0;
    languageGroups[language].totalDeletions += file.deletions || 0;
    languageGroups[language].totalChanges += (file.additions || 0) + (file.deletions || 0);
  });

  return languageGroups;
}

export function getSupportedLanguages() {
  const languages = new Set(Object.values(LANGUAGE_EXTENSIONS));
  Object.values(SPECIAL_FILENAMES).forEach(lang => languages.add(lang));
  return Array.from(languages).sort();
}