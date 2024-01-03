# Git Attributes Configuration (.gitattributes)

## Overview

The `.gitattributes` file specifies attributes for files and directories in a Git repository. It helps define how Git should handle line endings and automatic text file detection.

### Configuration Details

- **Pattern: `*`**
  - **Attributes:**
    - `text=auto`: Instructs Git to automatically detect whether a file is a text file.
    - `eol=lf`: Specifies the default end-of-line (EOL) character as Unix/Linux line endings (`LF`).

## Conclusion

The `.gitattributes` file ensures consistent handling of line endings and automatic text file detection in a Git repository. The specified configuration helps maintain cross-platform compatibility and a unified codebase.
