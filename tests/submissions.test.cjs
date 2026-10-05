const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const source = name => readFileSync(join(__dirname, '..', name), 'utf8');
const resultNode = text => ({ textContent: text, getAttribute: () => '', classList: { contains: () => false } });
const article = {
    getAttribute: () => '',
    textContent: 'Find two numbers.\n[2, 7], target = 9',
    childNodes: [
        { nodeType: 1, tagName: 'P', textContent: 'Find two numbers.' },
        { nodeType: 1, tagName: 'PRE', textContent: '[2, 7], target = 9' }
    ]
};
const submission = { type: 'LEETCODE_CODE_DATA', title: 'two-sum', code: 'return "✓";', language: 'javascript' };

function contentHarness() {
    const observers = new Set();
    const timers = new Map();
    const toasts = [];
    const requests = [];
    let listener;
    let timerId = 0;
    const page = { result: null, article, heading: { textContent: '1. Two Sum', getAttribute: () => '' }, neetcodeResult: null };
    const context = vm.createContext({
        console: { error() {} }, TextEncoder, AbortController, btoa,
        Node: { TEXT_NODE: 3, ELEMENT_NODE: 1 },
        location: { hostname: 'leetcode.com', pathname: '/problems/two-sum/description/' },
        config: { github: { username: 'test', repo_name: 'solutions', token: 'fake', committer_name: 'Test', committer_email: 'test@example.com' } },
        setTimeout(callback) { timers.set(++timerId, callback); return timerId; },
        clearTimeout(id) { timers.delete(id); },
        MutationObserver: class {
            constructor(callback) { this.callback = callback; }
            observe(target, options) { this.options = options; observers.add(this); }
            disconnect() { observers.delete(this); }
        },
        document: {
            body: {}, documentElement: {},
            querySelector(selector) {
                if (selector === '[data-e2e-locator="submission-result"]') return page.result;
                if (selector.includes('description_content') || selector === '.my-article-component-container') return page.article;
                if (selector.includes('question-title') || selector === 'h1') return page.heading;
                if (selector === '.selected-language') return { textContent: 'Python', getAttribute: () => '' };
                if (selector.includes('submission-result-accepted')) return page.neetcodeResult;
                throw new Error(`Unexpected selector: ${selector}`);
            }
        },
        chrome: { runtime: { onMessage: { addListener(fn) { listener = fn; } } } },
        async fetch(url, options) {
            requests.push({ url, options });
            return { status: 201, json: async () => ({}) };
        }
    });
    vm.runInContext(source('content-script.js'), context);
    context.showToast = message => toasts.push(message);
    return {
        context, page, requests, toasts, observers, timers,
        send: message => listener(message),
        mutate() { for (const observer of [...observers]) observer.callback([]); },
        expire() { for (const callback of [...timers.values()]) callback(); }
    };
}

test('LeetCode accepted submission uploads captured code and Markdown sequentially', async () => {
    const h = contentHarness();
    const done = h.send(submission);
    assert.equal(h.requests.length, 0);
    assert.equal([...h.observers][0].options.characterData, true);
    h.page.article = null;
    h.page.result = resultNode('Accepted');
    h.mutate();
    await done;
    assert.equal(h.requests.length, 2);
    assert.match(h.requests[0].url, /\/leetcode\/two-sum\/\d{4}-\d{2}-\d{2}\/solution\.js$/);
    assert.match(h.requests[1].url, /\/problem\.md$/);
    const decode = request => Buffer.from(JSON.parse(request.options.body).content, 'base64').toString();
    assert.equal(decode(h.requests[0]), submission.code);
    assert.equal(decode(h.requests[1]), '# **Two Sum**\n\nFind two numbers.\n\n```\n[2, 7], target = 9\n```');
    assert.deepEqual(h.toasts, ['Successfully added to GitHub']);
    assert.equal(h.observers.size, 0);
    assert.equal(h.timers.size, 0);
});

for (const status of ['Wrong Answer', 'Runtime Error', 'Compile Error', 'Time Limit Exceeded', 'Memory Limit Exceeded', 'Output Limit Exceeded']) {
    test(`LeetCode ${status} skips uploads`, async () => {
        const h = contentHarness();
        const done = h.send(submission);
        h.page.result = resultNode(status);
        h.mutate();
        await done;
        assert.equal(h.requests.length, 0);
        assert.deepEqual(h.toasts, ['Submission not accepted, skipping GitHub sync']);
    });
}

test('LeetCode unchanged accepted result and incomplete results time out without uploads', async () => {
    for (const initial of [null, resultNode('Accepted'), resultNode('Pending')]) {
        const h = contentHarness();
        h.page.result = initial;
        const done = h.send(submission);
        h.mutate();
        h.expire();
        await done;
        assert.equal(h.requests.length, 0);
        assert.equal(h.observers.size, 0);
    }
});

test('LeetCode accepts a reused result node only after its text changes', async () => {
    const h = contentHarness();
    h.page.result = resultNode('Accepted');
    const done = h.send(submission);
    h.page.result.textContent = 'Pending';
    h.mutate();
    assert.equal(h.requests.length, 0);
    h.page.result.textContent = 'Accepted';
    h.mutate();
    await done;
    assert.equal(h.requests.length, 2);
});

test('LeetCode removal and reinsertion counts as a fresh result', async () => {
    const h = contentHarness();
    const old = resultNode('Accepted');
    h.page.result = old;
    const done = h.send(submission);
    h.page.result = null;
    h.mutate();
    h.page.result = old;
    h.mutate();
    await done;
    assert.equal(h.requests.length, 2);
});

test('LeetCode cancels an earlier pending submission when another starts', async () => {
    const h = contentHarness();
    const first = h.send(submission);
    const second = h.send({ ...submission, code: 'new code' });
    h.page.result = resultNode('Accepted');
    h.mutate();
    await Promise.all([first, second]);
    assert.equal(h.requests.length, 2);
    assert.equal(Buffer.from(JSON.parse(h.requests[0].options.body).content, 'base64').toString(), 'new code');
});

test('LeetCode navigation and missing description prevent uploads', async () => {
    for (const scenario of ['navigate', 'description']) {
        const h = contentHarness();
        if (scenario === 'description') h.page.article = null;
        const done = h.send(submission);
        if (scenario === 'navigate') h.context.location.pathname = '/problems/reverse-integer/';
        h.page.result = resultNode('Accepted');
        h.mutate();
        await done;
        assert.equal(h.requests.length, 0);
    }
});

test('LeetCode wrong host, problem, and invalid messages are ignored', async () => {
    const h = contentHarness();
    await h.send({ ...submission, title: 'different' });
    await h.send({ ...submission, code: '' });
    await h.send({ ...submission, language: null });
    h.context.location.hostname = 'leetcode.cn';
    await h.send(submission);
    assert.equal(h.observers.size, 0);
    assert.equal(h.requests.length, 0);
});

test('language mapping supports LeetCode slugs and preserves NeetCode names', () => {
    const h = contentHarness();
    for (const [language, extension] of Object.entries({ python3: 'py', cpp: 'cpp', java: 'java', javascript: 'js', typescript: 'ts', csharp: 'cs', golang: 'go', Python: 'py', 'C#': 'c', JavaScript: 'js' })) {
        assert.equal(h.context.getLanguage(language), extension);
    }
});

test('NeetCode accepted and rejected results retain their existing upload behavior', async () => {
    for (const accepted of [true, false]) {
        const h = contentHarness();
        h.page.heading.textContent = 'Two Sum';
        const done = h.send({ type: 'CODE_DATA', title: 'two-sum', code: 'pass' });
        h.page.neetcodeResult = { getAttribute: () => '', classList: { contains: name => accepted && name === 'submission-result-accepted' } };
        h.mutate();
        await done;
        assert.equal(h.requests.length, accepted ? 2 : 0);
        if (accepted) assert.match(h.requests[0].url, /\/neetcode\/two-sum\/\d{4}-\d{2}-\d{2}\/solution\.py$/);
    }
});

test('identical GitHub content skips updating the file', async () => {
    const h = contentHarness();
    let calls = 0;
    h.context.fetch = async () => {
        calls++;
        return calls === 1
            ? { status: 422, json: async () => ({}) }
            : { status: 200, json: async () => ({ sha: 'existing', content: btoa('same') }) };
    };
    const result = await h.context.addToGithub('same', 'two-sum', 'solution', 'py', 'neetcode');
    assert.equal(calls, 2);
    assert.equal(result.updated, true);
    assert.equal(result.status, 200);
});

test('LeetCode reports partial and total GitHub failures', async () => {
    for (const statuses of [[201, 403], [403, 403]]) {
        const h = contentHarness();
        let index = 0;
        h.context.fetch = async () => ({ status: statuses[index++], json: async () => ({}) });
        const done = h.send(submission);
        h.page.result = resultNode('Accepted');
        h.mutate();
        await done;
        assert.equal(h.toasts[0], statuses[0] === 201 ? 'Solution saved, problem description failed' : 'Failed to add to GitHub');
    }
});

test('GitHub transient failure retries and then uploads both files', async () => {
    const h = contentHarness();
    let calls = 0;
    h.context.setTimeout = callback => { queueMicrotask(callback); return 1; };
    h.context.fetch = async () => ({ status: ++calls === 1 ? 503 : 201, json: async () => ({}) });
    const result = await h.context.addContentToGitHub('pass', 'two-sum', 'Description', 'python3', 'leetcode');
    assert.equal(calls, 3);
    assert.equal(result.solution.status, 201);
    assert.equal(result.problem.status, 201);
});

test('background captures only LeetCode submit POSTs and targets the main frame', async () => {
    const listeners = [];
    const messages = [];
    let installed;
    let query;
    const injected = [];
    const context = vm.createContext({
        URL, TextDecoder, Uint8Array, console: { error() {} },
        chrome: {
            webRequest: { onBeforeRequest: { addListener(fn, filter) { listeners.push({ fn, filter }); } } },
            tabs: {
                sendMessage(...args) { messages.push(args); return Promise.resolve(); },
                async query(options) { query = options; return [{ id: 1 }, { id: 2 }]; }
            },
            runtime: { onInstalled: { addListener(fn) { installed = fn; } } },
            scripting: { async executeScript(options) { injected.push(options); } }
        }
    });
    vm.runInContext(source('background.js'), context);
    const listener = listeners.find(item => item.filter.urls[0].includes('leetcode.com'));
    const bytes = new TextEncoder().encode(JSON.stringify({ typed_code: '✓', lang: 'python3' }));
    const split = bytes.indexOf(0xe2) + 1;
    const details = { url: 'https://leetcode.com/problems/two-sum/submit/', method: 'POST', tabId: 1, requestBody: { raw: [{ bytes: bytes.slice(0, split).buffer }, { bytes: bytes.slice(split).buffer }] } };
    listener.fn(details);
    assert.equal(messages.length, 1);
    assert.equal(messages[0][1].code, '✓');
    assert.equal(messages[0][1].title, 'two-sum');
    assert.equal(messages[0][1].language, 'python3');
    assert.equal(messages[0][2].frameId, 0);
    for (const override of [
        { url: 'https://leetcode.com/problems/two-sum/interpret_solution/' },
        { method: 'GET' }, { tabId: -1 }, { requestBody: undefined },
        { requestBody: { raw: [{ bytes: new TextEncoder().encode('{bad').buffer }] } }
    ]) listener.fn({ ...details, ...override });
    assert.equal(messages.length, 1);
    const neetcode = listeners.find(item => item.filter.urls[0].includes('neetcode.io'));
    neetcode.fn({ url: 'https://neetcode.io/api/executeCodeFunctionHttp', tabId: 2, requestBody: { raw: [{ bytes: new TextEncoder().encode(JSON.stringify({ data: { problemId: 'two-sum', rawCode: 'pass' } })).buffer }] } });
    assert.equal(messages[1][1].type, 'CODE_DATA');
    assert.equal(messages[1][1].code, 'pass');
    await installed();
    assert.ok(query.url.includes('https://leetcode.com/*'));
    assert.ok(query.url.includes('https://neetcode.io/*'));
    assert.equal(injected.length, 2);
});
