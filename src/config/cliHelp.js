export function showCliHelp() {
  console.log(`
Language Video Factory

Usage:
  npm start
  npm start -- [options]

Options:

  --word=<word>
      Select one word.

      Example:
        npm start -- --word=Bicycle

  --words=<word1,word2>
      Select multiple words.

      Example:
        npm start -- --words=Bicycle,Apple

  --category=<category>
      Filter words by category.

      Example:
        npm start -- --category=Transport

  --level=<level>
      Filter words by language level.

      Example:
        npm start -- --level=A1

  --content=<content>
      Select video content mode.

      Available:
        default
        simple
        quiz

      Example:
        npm start -- --content=quiz

  --design=<design>
      Select video design.

      Available:
        default
        minimal

      Example:
        npm start -- --design=minimal

  --dry-run
      Preview selected words and settings without running
      the generation pipeline.

  --help
  -h
      Show this help message.

Examples:

  npm start -- --word=Bicycle

  npm start -- --words=Bicycle,Apple

  npm start -- --category=Transport --level=A1

  npm start -- --word=Bicycle --content=quiz --design=minimal

  npm start -- --words=Bicycle,Apple --content=simple --design=minimal

  npm start -- --category=Transport --dry-run

  npm start -- --words=Bicycle,Apple --content=quiz --design=minimal --dry-run
`);
}