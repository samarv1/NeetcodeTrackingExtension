# NeetCode and LeetCode Tracking Extension

A Chrome extension that captures accepted solutions and problem descriptions from NeetCode and LeetCode, then uploads them to your GitHub repository.

Supports NeetCode and standard problem pages on `leetcode.com`.

I use this because NeetCode's built-in GitHub sync does not work with private submission repositories.

## Features

- **Automatic Code Capture**: Captures your solution code when you submit it on NeetCode or LeetCode, and only uploads it if the page reports an accepted submission. LeetCode's Run Code requests do not trigger uploads
- **Problem Description**: Extracts and formats the problem description in Markdown
- **GitHub Integration**: Automatically uploads both solution and problem files to your GitHub repository
- **Organized Structure**: Creates a clean folder structure: `{site}/{problem-name}/{date}/`
- **Multiple Languages**: Supports various programming languages (Python, Java, C++, JavaScript, etc.)
- **In-page Feedback**: Shows a toast on the problem page telling you whether the upload succeeded

## Installation

### 1. Clone or Download the Extension

```bash
git clone https://github.com/adarshdanda06/NeetcodeTrackingExtension
cd NeetcodeTrackingExtension
```

### 2. Create a GitHub Repository

Create a new GitHub repository where you want to track your NeetCode and LeetCode progress:

1. Go to [GitHub](https://github.com) and sign in
2. Click the "+" icon in the top right corner
3. Select "New repository"
4. Name your repository (e.g., "neetcode-solutions" or "coding-progress")
5. Choose public or private (your preference)
6. Click "Create repository"
7. **Note down the repository name** - you'll need it for the config file

### 3. Create Configuration File

**IMPORTANT**: You need to create a `config.js` file in the root directory with your GitHub credentials.

Create `config.js` with the following structure:

```javascript
const config = {
    github: {
        username: "your-github-username",
        repo_name: "your-repository-name",
        token: "your-github-personal-access-token",
        committer_name: "Your Name",
        committer_email: "your-email@example.com"
    }
};
```

#### How to Get GitHub Personal Access Token:

1. Go to GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. Click "Generate new token"
3. Give it a name like "Neetcode_Extension_Token"
4. Go to Repository Access: `Only select repositories` and select the repository you created
5. Go to the Repository select and select Repository Permissions. You will drop down. Scroll to the Contents section and select the `Access` dropdown. Click `Read and write`. 
7. Click `Generate Token`
6. Copy the generated token and paste it in your `config.js`

### 4. Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the folder containing your extension files

## File Structure

```
NeetcodeTrackingExtension/
├── manifest.json
├── background.js
├── content-script.js
├── config.js (you need to create this)
└── README.md
```

## How It Works

1. **Background Script** (`background.js`): Captures NeetCode execution requests and LeetCode submission requests
2. **Content Script** (`content-script.js`): Extracts problem descriptions and handles GitHub uploads
3. **Configuration** (`config.js`): Contains your GitHub credentials and repository settings

## Usage

1. **Navigate to a problem** on [NeetCode](https://neetcode.io/problems/two-integer-sum?list=neetcode150/) or [LeetCode](https://leetcode.com/problems/two-sum/description/). Keep the problem description open when submitting on LeetCode
2. **Write your solution** in the code editor
3. **Submit your solution** (click "Submit")
4. **Extension automatically captures** your code and the problem description
5. **Files are uploaded to GitHub** if the submission is accepted, in the following structure:
   ```
   leetcode/
   └── two-sum/
       └── 2024-01-15/
           ├── solution.py (or .js, .java, etc.)
           └── problem.md
   ```

NeetCode solutions use the same structure under `neetcode/`. LeetCode uses the problem's URL slug for its folder name, such as `two-sum`. The site folders keep questions with matching names separate.

LeetCode waits up to 15 seconds for a fresh submission result. Failed submissions, unchanged old results, and timeouts skip the upload. If the problem description is unavailable, the upload also skips. NeetCode's existing result detection is unchanged.

## Supported Languages

The extension automatically detects and uses the correct file extension for:
- Python (`.py`)
- JavaScript (`.js`)
- Java (`.java`)
- C++ (`.cpp`)
- C# (`.cs` on LeetCode; the existing NeetCode mapping remains `.c`)

LeetCode also maps Python3 to `.py` and supports TypeScript, C, Go, Rust, Ruby, Swift, Kotlin, Scala, PHP, Dart, Racket, Erlang, Elixir, SQL, and Bash file extensions. It reads the language from the submitted request.


## Troubleshooting

### Extension Not Working?

1. **Check Console**: Open DevTools (F12) and check for errors
2. **Verify Config**: Ensure `config.js` exists and has correct credentials
3. **Check Permissions**: Make sure the personal access token has necessary permissions
4. **Reload Extension**: Go to `chrome://extensions/` and click the refresh icon

### Files Not Uploading to GitHub?

1. **Verify Token**: Check if your GitHub token is valid and has correct permissions
2. **Repository Access**: Ensure the repository exists and you have write access
3. **Network Issues**: Check if you can access GitHub from your browser

### Language Detection Issues?

- The extension defaults to Python (`.py`) if it can't detect the language
- Check if the language selector on NeetCode is properly loaded

## Code-based Verification

Run the tests with Node.js 22 or later. No dependency installation is needed:

```bash
node --test tests/submissions.test.cjs
```

The tests use mocked Chrome APIs, page elements, and GitHub responses. They cover submission capture, accepted and rejected results, stale results, timeouts, navigation, overlapping submissions, language mapping, upload failures and retries, unchanged content, and NeetCode regression cases.

These checks pass without browser testing or live GitHub writes. Live LeetCode compatibility still needs manual verification: reload the extension and problem tab, submit an accepted solution, and check GitHub. Then verify that Run Code and a rejected submission do not upload files.

## Security Notes

- **Never commit your `config.js`** file to version control
- **Keep your GitHub token secure** - it provides access to your repositories

## Contributing

Feel free to submit issues and enhancement requests!

## License

This project is open source and available under the [MIT License](LICENSE).
