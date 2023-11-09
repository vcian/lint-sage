# Lint Sage

Welcome to `lint sage`, a package designed to simplify the configuration of your projects. This package automates the setup of essential tools and configurations to ensure a clean and consistent codebase. By using `lint sage`, you'll save time and effort in setting up your projects.

1. **ESLint with Standard Rules**: This package configures ESLint with a set of standard rules to help you maintain code quality and consistency. ESLint is a powerful linter for JavaScript and TypeScript that identifies and fixes common programming errors.

2. **Prettier**: Prettier is a code formatter that ensures your code is well-formatted and follows a consistent style. It integrates seamlessly with ESLint for a smooth development experience.

3. **Husky**: Husky is a tool that hooks into your Git workflow to run pre-commit and pre-push scripts. With `lint sage`, you can configure Husky to run linting and formatting checks before committing your changes, ensuring that only clean code is pushed to your repository.

4. **Lint Stage**: Lint Staged is a tool that runs ESLint and Prettier on the files you've staged for commit. This ensures that your staged changes meet the defined code standards before they are committed.

5. **.vscode Configuration**: We provide a predefined VS Code configuration for your project, including settings that work seamlessly with ESLint and Prettier. This ensures that your development environment is optimized for clean and efficient coding.

## Getting Started

To get started with `lint sage`, follow these steps:

```sh
npx @vcian/lint-sage@latest init
```

For force initialization, follow these steps:

```sh
npx @vcian/lint-sage@latest init --force
```

## License

This package is distributed under the **MIT license**. Feel free to use, modify, and distribute it as needed.

For details, please see the [LICENSE file](LICENSE) included with this package.

Contributions and feedback are always welcome!

## Issues and Support

If you encounter any issues, have questions, or need support, we're here to help. You can reach out in the following ways:

- **GitHub Issues**: If you discover a bug, have suggestions for improvements, or need assistance, please open an issue on our [GitHub repository](https://github.com/vcian/lint-sage/issues). This is the primary way to get help and provide feedback.

- **Community Discussions**: Join our community discussions on [GitHub Discussions](https://github.com/vcian/lint-sage/discussions). Share your experiences, ask questions, and connect with other users.

We're committed to making your experience with `lint sage` as smooth as possible and are eager to assist with any issues or questions you may have. Your feedback and contributions are highly valued.

Happy coding!
