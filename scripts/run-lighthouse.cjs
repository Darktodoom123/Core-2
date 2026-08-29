/**
 * Automated Unbiased Lighthouse Performance & Accessibility Runner
 *
 * Supports auditing the entire website/app suite:
 * - Public routes: /login, /forgot-password, etc.
 * - Authenticated routes: /, /operations, /operations/dispatch-jobs/{id}
 * - Multi-iteration runs (median score extraction) for Mobile & Desktop
 * - Automatically fetches session cookies for protected routes
 */

'use strict';

const { spawn, execSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');
const REPORT_DIR = path.join(ROOT_DIR, '.ai-reports', 'lighthouse');
const BASE_URL = process.env.LIGHTHOUSE_BASE_URL || 'http://127.0.0.1:4173';
const FIXTURES_PATH = path.join(ROOT_DIR, 'storage', 'framework', 'testing', 'browser-fixtures.json');

// Parse CLI flags
const args = process.argv.slice(2);
const getArgValue = (name, fallback) => {
    const matched = args.find((arg) => arg.startsWith(`--${name}=`));

    if (matched) {
return matched.split('=')[1];
}

    if (args.includes(`--${name}`)) {
return true;
}

    return fallback;
};

const shouldBuild = getArgValue('build', false);
const presetArg = getArgValue('preset', 'both'); // 'mobile', 'desktop', or 'both'
const runsCount = Math.max(1, parseInt(getArgValue('runs', '3'), 10));
const customUrl = getArgValue('url', null);
const runAllPages = getArgValue('all', false);

let serverProcess = null;
let authCookieHeader = null;

// Ensure output directories exist
if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
}

// 1. Production build verification
function ensureProductionBuild() {
    const manifestPath = path.join(ROOT_DIR, 'public', 'build', 'manifest.json');

    if (shouldBuild || !fs.existsSync(manifestPath)) {
        console.log('📦 Building production frontend assets (npm run build)...');
        execSync('npm run build', { cwd: ROOT_DIR, stdio: 'inherit' });
    }
}

// 2. Server ping utility
function pingServer(url, timeoutMs = 1500) {
    return new Promise((resolve) => {
        const req = http.get(url, (res) => {
            res.resume();
            resolve(res.statusCode >= 200 && res.statusCode < 500);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(timeoutMs, () => {
            req.destroy();
            resolve(false);
        });
    });
}

// 3. Start local testing web server
async function ensureServerRunning() {
    const isAlreadyRunning = await pingServer(`${BASE_URL}/login`);

    if (isAlreadyRunning) {
        console.log(`⚡ Found active server running at ${BASE_URL}`);

        return;
    }

    console.log('🚀 Spawning test web server (php tests/Browser/web-server.php)...');
    serverProcess = spawn('php', ['tests/Browser/web-server.php'], {
        cwd: ROOT_DIR,
        stdio: 'pipe',
        detached: false,
    });

    serverProcess.on('exit', (code) => {
        if (code !== 0 && code !== null) {
            console.error(`❌ Web server exited with code ${code}`);
        }
    });

    const startTime = Date.now();
    const maxWaitMs = 60000;

    while (Date.now() - startTime < maxWaitMs) {
        await new Promise((r) => setTimeout(r, 800));
        const ready = await pingServer(`${BASE_URL}/login`);

        if (ready) {
            console.log(`✅ Server is ready at ${BASE_URL}`);

            return;
        }
    }

    throw new Error(`Timed out waiting for test server to start at ${BASE_URL}`);
}

// 4. Authenticate via Playwright / HTTP to grab session cookies
async function obtainAuthSession() {
    if (authCookieHeader) {
return authCookieHeader;
}

    console.log('🔑 Authenticating test session for protected routes...');

    try {
        let fixtures = {};

        if (fs.existsSync(FIXTURES_PATH)) {
            fixtures = JSON.parse(fs.readFileSync(FIXTURES_PATH, 'utf8'));
        }

        const username = fixtures.users?.manager || fixtures.users?.dispatcher || 'manager';
        const password = fixtures.password || 'password';

        // Use a lightweight node script with playwright to authenticate and get cookie
        const authScript = `
            const { chromium } = require('@playwright/test');
            (async () => {
                const browser = await chromium.launch({ headless: true });
                const page = await browser.newPage();
                await page.goto('${BASE_URL}/login');
                await page.getByLabel('Username').fill('${username}');
                await page.getByLabel('Password').fill('${password}');
                await page.getByRole('button', { name: 'Sign in' }).click();
                await page.waitForURL(url => !url.pathname.includes('/login'));
                const cookies = await page.context().cookies();
                await browser.close();
                const cookieStr = cookies.map(c => \`\${c.name}=\${c.value}\`).join('; ');
                process.stdout.write(cookieStr);
            })();
        `;

        const cookieResult = execSync(`node -e "${authScript.replace(/\n/g, ' ')}"`, {
            cwd: ROOT_DIR,
            encoding: 'utf8',
            timeout: 30000,
        }).trim();

        if (cookieResult) {
            authCookieHeader = cookieResult;
            console.log('✅ Successfully obtained authenticated session cookies.');

            return authCookieHeader;
        }
    } catch (err) {
        console.warn('⚠️ Could not obtain authenticated session cookie:', err.message);
    }

    return null;
}

// 5. Build route targets
function resolveTargetRoutes() {
    if (customUrl) {
        return [{
            name: 'Custom URL',
            url: customUrl.startsWith('http') ? customUrl : `${BASE_URL}${customUrl}`,
            authenticated: false,
        }];
    }

    let fixtures = {};

    if (fs.existsSync(FIXTURES_PATH)) {
        try {
            fixtures = JSON.parse(fs.readFileSync(FIXTURES_PATH, 'utf8'));
        } catch {
            // ignore
        }
    }

    const jobId = fixtures.job_id || 1;

    const runDeep = getArgValue('deep', false);

    if (runDeep) {
        return [
            { name: 'Sign In (Public)', url: `${BASE_URL}/login`, authenticated: false },
            { name: 'Forgot Password (Public)', url: `${BASE_URL}/forgot-password`, authenticated: false },
            { name: 'Reset Password (Public)', url: `${BASE_URL}/reset-password/sample-token?email=test%40example.com`, authenticated: false },
            { name: 'Workspace - Overview (Sidebar)', url: `${BASE_URL}/?section=overview`, authenticated: true },
            { name: 'Workspace - Dispatch (Sidebar)', url: `${BASE_URL}/?section=dispatch`, authenticated: true },
            { name: 'Workspace - Fleet Assets (Sidebar)', url: `${BASE_URL}/?section=assets`, authenticated: true },
            { name: 'Workspace - Fuel Requests (Sidebar)', url: `${BASE_URL}/?section=fuel`, authenticated: true },
            { name: 'Workspace - Live Tracking Map (Sidebar)', url: `${BASE_URL}/?section=tracking`, authenticated: true },
            { name: 'Workspace - Approvals (Sidebar)', url: `${BASE_URL}/?section=approvals`, authenticated: true },
            { name: 'Workspace - Reports (Sidebar)', url: `${BASE_URL}/?section=reports`, authenticated: true },
            { name: 'Workspace - AI Recommendations (Sidebar)', url: `${BASE_URL}/?section=gpt-recommendations`, authenticated: true },
            { name: 'Workspace - Users & Personnel (Sidebar)', url: `${BASE_URL}/?section=users`, authenticated: true },
            { name: 'Workspace - Audit Events (Sidebar)', url: `${BASE_URL}/?section=audit`, authenticated: true },
            { name: 'Dispatch Job Workspace (Auth)', url: `${BASE_URL}/operations/dispatch-jobs/${jobId}`, authenticated: true },
        ];
    }

    if (runAllPages) {
        return [
            { name: 'Sign In (Public)', url: `${BASE_URL}/login`, authenticated: false },
            { name: 'Forgot Password (Public)', url: `${BASE_URL}/forgot-password`, authenticated: false },
            { name: 'Reset Password (Public)', url: `${BASE_URL}/reset-password/sample-token?email=test%40example.com`, authenticated: false },
            { name: 'Operations Workspace (Auth)', url: `${BASE_URL}/`, authenticated: true },
            { name: 'Dispatch Job Workspace (Auth)', url: `${BASE_URL}/operations/dispatch-jobs/${jobId}`, authenticated: true },
        ];
    }

    // Default target
    return [
        { name: 'Sign In (Public)', url: `${BASE_URL}/login`, authenticated: false },
    ];
}

// 6. Safe process cleanup
function cleanupServer() {
    if (serverProcess && serverProcess.pid) {
        console.log('\n🧹 Terminating test server...');

        try {
            if (process.platform === 'win32') {
                execSync(`taskkill /F /T /PID ${serverProcess.pid}`, { stdio: 'ignore' });
            } else {
                serverProcess.kill('SIGKILL');
            }
        } catch {
            // Process may have already exited
        }

        serverProcess = null;
    }
}

// Ensure cleanup on exit signals
process.on('SIGINT', () => {
    cleanupServer();
    process.exit(1);
});
process.on('SIGTERM', () => {
    cleanupServer();
    process.exit(1);
});
process.on('exit', () => {
    cleanupServer();
});

// 7. Run single lighthouse audit iteration
function runLighthouseIteration(target, formFactor) {
    const isDesktop = formFactor === 'desktop';
    const tempJsonPath = path.join(REPORT_DIR, `temp-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);

    const flags = [
        '--yes',
        'lighthouse',
        `"${target.url}"`,
        '--output=json',
        `--output-path="${tempJsonPath}"`,
        '--chrome-flags="--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage --disable-software-rasterizer"',
        '--quiet',
        '--skip-audits=uses-http2',
    ];

    if (isDesktop) {
        flags.push('--preset=desktop');
    }

    if (target.authenticated && authCookieHeader) {
        const escapedCookie = JSON.stringify({ Cookie: authCookieHeader }).replace(/"/g, '\\"');
        flags.push(`--extra-headers="${escapedCookie}"`);
    }

    try {
        execSync(`npx ${flags.join(' ')}`, {
            cwd: ROOT_DIR,
            stdio: 'pipe',
            timeout: 90000,
        });

        if (fs.existsSync(tempJsonPath)) {
            const raw = fs.readFileSync(tempJsonPath, 'utf8');
            fs.unlinkSync(tempJsonPath);

            return JSON.parse(raw);
        }
    } catch (err) {
        if (fs.existsSync(tempJsonPath)) {
            fs.unlinkSync(tempJsonPath);
        }

        console.error(`⚠️ Lighthouse iteration failed for ${target.url} (${formFactor}):`, err.message);
    }

    return null;
}

// 8. Generate final HTML report for median run
function generateHtmlReport(target, formFactor, outputPath) {
    const isDesktop = formFactor === 'desktop';
    const flags = [
        '--yes',
        'lighthouse',
        `"${target.url}"`,
        '--output=html',
        `--output-path="${outputPath}"`,
        '--chrome-flags="--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage --disable-software-rasterizer"',
        '--quiet',
        '--skip-audits=uses-http2',
    ];

    if (isDesktop) {
flags.push('--preset=desktop');
}

    if (target.authenticated && authCookieHeader) {
        const escapedCookie = JSON.stringify({ Cookie: authCookieHeader }).replace(/"/g, '\\"');
        flags.push(`--extra-headers="${escapedCookie}"`);
    }

    try {
        execSync(`npx ${flags.join(' ')}`, {
            cwd: ROOT_DIR,
            stdio: 'pipe',
            timeout: 90000,
        });
    } catch (err) {
        console.error(`⚠️ Failed to generate HTML report:`, err.message);
    }
}

// Helper to extract clean audit metrics
function extractMetrics(lhr) {
    const categories = lhr.categories || {};
    const audits = lhr.audits || {};

    const formatScore = (cat) => (cat ? Math.round(cat.score * 100) : 0);

    const fcp = audits['first-contentful-paint']?.numericValue;
    const lcp = audits['largest-contentful-paint']?.numericValue;
    const tbt = audits['total-blocking-time']?.numericValue;
    const cls = audits['cumulative-layout-shift']?.numericValue;
    const speedIndex = audits['speed-index']?.numericValue;

    const opportunities = Object.values(audits)
        .filter((a) => a.details && a.details.type === 'opportunity' && (a.numericValue || 0) > 100)
        .sort((a, b) => (b.numericValue || 0) - (a.numericValue || 0))
        .map((a) => ({
            title: a.title,
            savingsMs: Math.round(a.numericValue || 0),
            description: a.description,
        }))
        .slice(0, 5);

    const a11yViolations = Object.values(audits)
        .filter((a) => categories.accessibility && categories.accessibility.auditRefs?.some((ref) => ref.id === a.id) && a.score === 0)
        .map((a) => ({
            title: a.title,
            description: a.description,
        }))
        .slice(0, 5);

    return {
        scores: {
            performance: formatScore(categories.performance),
            accessibility: formatScore(categories.accessibility),
            bestPractices: formatScore(categories['best-practices']),
            seo: formatScore(categories.seo),
        },
        coreWebVitals: {
            fcpMs: fcp ? Math.round(fcp) : null,
            lcpMs: lcp ? Math.round(lcp) : null,
            tbtMs: tbt ? Math.round(tbt) : null,
            cls: cls !== undefined ? Number(cls.toFixed(3)) : null,
            speedIndexMs: speedIndex ? Math.round(speedIndex) : null,
        },
        opportunities,
        a11yViolations,
    };
}

// Format score badge
function getScoreEmoji(score) {
    if (score >= 90) {
return `🟢 ${score}%`;
}

    if (score >= 50) {
return `🟡 ${score}%`;
}

    return `🔴 ${score}%`;
}

// Format CWV badge
function getMetricBadge(metricName, val) {
    if (val === null || val === undefined) {
return 'N/A';
}

    if (metricName === 'lcp') {
        const sec = (val / 1000).toFixed(2);

        return val <= 2500 ? `🟢 ${sec}s` : val <= 4000 ? `🟡 ${sec}s` : `🔴 ${sec}s`;
    }

    if (metricName === 'fcp') {
        const sec = (val / 1000).toFixed(2);

        return val <= 1800 ? `🟢 ${sec}s` : val <= 3000 ? `🟡 ${sec}s` : `🔴 ${sec}s`;
    }

    if (metricName === 'tbt') {
        return val <= 200 ? `🟢 ${val}ms` : val <= 600 ? `🟡 ${val}ms` : `🔴 ${val}ms`;
    }

    if (metricName === 'cls') {
        return val <= 0.1 ? `🟢 ${val}` : val <= 0.25 ? `🟡 ${val}` : `🔴 ${val}`;
    }

    return `${val}`;
}

// Main execution function
async function main() {
    console.log('====================================================');
    console.log('🚀 AUTOMATED UNBIASED LIGHTHOUSE AUDIT SYSTEM 🚀');
    console.log('====================================================\n');

    ensureProductionBuild();
    await ensureServerRunning();

    const targets = resolveTargetRoutes();
    const hasAuthTargets = targets.some((t) => t.authenticated);

    if (hasAuthTargets) {
        await obtainAuthSession();
    }

    const presetsToRun = presetArg === 'both' ? ['mobile', 'desktop'] : [presetArg];
    const allResults = [];

    console.log(`Auditing ${targets.length} target route(s) across [${presetsToRun.join(', ')}] profiles...\n`);

    for (const target of targets) {
        const parsedUrl = new URL(target.url);
        const urlSlug = (parsedUrl.pathname + parsedUrl.search).replace(/[^a-zA-Z0-9]/g, '_') || 'root';

        for (const preset of presetsToRun) {
            console.log(`\n📊 Auditing [${preset.toUpperCase()}] -> ${target.name} (${target.url})`);
            console.log(`   Running ${runsCount} iteration(s) to compute unbiased median...`);

            const iterationResults = [];

            for (let i = 1; i <= runsCount; i++) {
                process.stdout.write(`   → Iteration ${i}/${runsCount}... `);
                const lhr = runLighthouseIteration(target, preset);

                if (lhr) {
                    iterationResults.push(lhr);
                    const perf = lhr.categories?.performance?.score ? Math.round(lhr.categories.performance.score * 100) : 0;
                    console.log(`(Perf: ${perf}%)`);
                } else {
                    console.log(`(Failed)`);
                }
            }

            if (iterationResults.length === 0) {
                console.error(`❌ All iterations failed for ${target.url} [${preset}]`);
                continue;
            }

            // Pick median run based on performance score
            iterationResults.sort((a, b) => {
                const pA = a.categories?.performance?.score || 0;
                const pB = b.categories?.performance?.score || 0;

                return pA - pB;
            });
            const medianLhr = iterationResults[Math.floor(iterationResults.length / 2)];
            const metrics = extractMetrics(medianLhr);

            const htmlFilename = `${urlSlug}-${preset}.html`;
            const jsonFilename = `${urlSlug}-${preset}.json`;
            const htmlPath = path.join(REPORT_DIR, htmlFilename);
            const jsonPath = path.join(REPORT_DIR, jsonFilename);

            fs.writeFileSync(jsonPath, JSON.stringify(medianLhr, null, 2), 'utf8');
            generateHtmlReport(target, preset, htmlPath);

            allResults.push({
                name: target.name,
                url: target.url,
                pathname: parsedUrl.pathname,
                preset,
                metrics,
                htmlReport: path.relative(ROOT_DIR, htmlPath),
                jsonReport: path.relative(ROOT_DIR, jsonPath),
            });
        }
    }

    // Generate markdown summary report
    let markdown = '# 🚀 Lighthouse Audit Summary Report\n\n';
    markdown += `**Audit Date**: ${new Date().toISOString()}\n`;
    markdown += `**Runs per target**: ${runsCount} (Median extraction)\n\n`;

    markdown += '## 📈 Category Scores\n\n';
    markdown += '| Page | Route | Preset | Performance | Accessibility | Best Practices | SEO |\n';
    markdown += '| :--- | :--- | :--- | :---: | :---: | :---: | :---: |\n';

    for (const r of allResults) {
        markdown += `| **${r.name}** | \`${r.pathname}\` | **${r.preset}** | ${getScoreEmoji(r.metrics.scores.performance)} | ${getScoreEmoji(r.metrics.scores.accessibility)} | ${getScoreEmoji(r.metrics.scores.bestPractices)} | ${getScoreEmoji(r.metrics.scores.seo)} |\n`;
    }

    markdown += '\n## ⚡ Core Web Vitals (Median)\n\n';
    markdown += '| Page | Preset | LCP (≤ 2.5s) | FCP (≤ 1.8s) | TBT (≤ 200ms) | CLS (≤ 0.1) | Speed Index |\n';
    markdown += '| :--- | :--- | :---: | :---: | :---: | :---: | :---: |\n';

    for (const r of allResults) {
        markdown += `| **${r.name}** | **${r.preset}** | ${getMetricBadge('lcp', r.metrics.coreWebVitals.lcpMs)} | ${getMetricBadge('fcp', r.metrics.coreWebVitals.fcpMs)} | ${getMetricBadge('tbt', r.metrics.coreWebVitals.tbtMs)} | ${getMetricBadge('cls', r.metrics.coreWebVitals.cls)} | ${r.metrics.coreWebVitals.speedIndexMs}ms |\n`;
    }

    markdown += '\n## 🔍 Top Identified Opportunities & Findings\n\n';

    for (const r of allResults) {
        markdown += `### ${r.name} (\`${r.pathname}\` - ${r.preset})\n`;
        markdown += `- **HTML Report**: [\`${r.htmlReport}\`](file:///${path.resolve(ROOT_DIR, r.htmlReport).replace(/\\/g, '/')})\n`;

        if (r.metrics.opportunities.length > 0) {
            markdown += `\n**Performance Opportunities:**\n`;

            for (const opp of r.metrics.opportunities) {
                markdown += `- **${opp.title}**: Potential savings ~${opp.savingsMs}ms\n`;
            }
        }

        if (r.metrics.a11yViolations.length > 0) {
            markdown += `\n**Accessibility Issues:**\n`;

            for (const a11y of r.metrics.a11yViolations) {
                markdown += `- **${a11y.title}**\n`;
            }
        }

        if (r.metrics.opportunities.length === 0 && r.metrics.a11yViolations.length === 0) {
            markdown += `- ✅ No high-impact bottlenecks detected.\n`;
        }

        markdown += '\n';
    }

    const summaryMdPath = path.join(REPORT_DIR, 'summary.md');
    const summaryJsonPath = path.join(REPORT_DIR, 'summary.json');
    fs.writeFileSync(summaryMdPath, markdown, 'utf8');
    fs.writeFileSync(summaryJsonPath, JSON.stringify(allResults, null, 2), 'utf8');

    console.log('\n====================================================');
    console.log('✅ AUDIT COMPLETE — RESULTS SUMMARY');
    console.log('====================================================\n');
    console.log(markdown);
    console.log(`\n📁 Machine summary written to: ${path.relative(ROOT_DIR, summaryJsonPath)}`);
    console.log(`📁 Markdown summary written to: ${path.relative(ROOT_DIR, summaryMdPath)}`);
}

main().catch((err) => {
    console.error('\n❌ Audit runner encountered a fatal error:', err);
    cleanupServer();
    process.exit(1);
});
