import * as vscode from 'vscode';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "suspicious-extension" is now active!');

	const helloWorld = vscode.commands.registerCommand('suspicious-extension.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from Suspicious Extension!');
	});

	// T1105 - Ingress Tool Transfer: downloads EICAR test file to demonstrate technique
	const ingressToolTransfer = vscode.commands.registerCommand('suspicious-extension.ingressToolTransfer', () => {
		const destPath = path.join(os.tmpdir(), 'eicar.com');
		const url = 'https://secure.eicar.org/eicar.com';

		vscode.window.showInformationMessage(`T1105: Downloading EICAR test file to ${destPath}...`);

		const file = fs.createWriteStream(destPath);
		https.get(url, (response) => {
			response.pipe(file);
			file.on('finish', () => {
				file.close();
				vscode.window.showWarningMessage(`T1105: EICAR test file written to ${destPath}`);
			});
		}).on('error', (err) => {
			fs.unlink(destPath, () => {});
			vscode.window.showErrorMessage(`T1105: Download failed — ${err.message}`);
		});
	});

	// T1552.001 - Credentials in Files: scans workspace + home directory for secrets patterns
	const credentialScrape = vscode.commands.registerCommand('suspicious-extension.credentialScrape', async () => {
		const MAX_FILE_BYTES = 1024 * 1024;

		const secretPatterns: { label: string; pattern: RegExp }[] = [
			{ label: 'password',    pattern: /(?:password|passwd|pwd)\s*[=:]\s*\S+/gi },
			{ label: 'api_key',     pattern: /(?:api_key|apikey|api-key)\s*[=:]\s*\S+/gi },
			{ label: 'secret',      pattern: /(?:secret|client_secret)\s*[=:]\s*\S+/gi },
			{ label: 'token',       pattern: /(?:token|access_token|auth_token)\s*[=:]\s*\S+/gi },
			{ label: 'aws_key',     pattern: /(?:AKIA|ASIA)[A-Z0-9]{16}/g },
			{ label: 'private_key', pattern: /-----BEGIN (?:\w+ )?PRIVATE KEY-----[\s\S]*?-----END (?:\w+ )?PRIVATE KEY-----/g },
		];

		async function walkDir(dir: string, depth: number, results: string[]): Promise<void> {
			if (depth > 4) { return; }
			let entries: fs.Dirent[];
			try {
				entries = await fs.promises.readdir(dir, { withFileTypes: true });
			} catch {
				return;
			}
			for (const entry of entries) {
				if (entry.name === 'node_modules' || entry.name === '.git') { continue; }
				const fullPath = path.join(dir, entry.name);
				if (entry.isDirectory()) {
					await walkDir(fullPath, depth + 1, results);
				} else {
					results.push(fullPath);
				}
			}
		}

		const output = vscode.window.createOutputChannel('T1552.001: Credentials In Files');
		context.subscriptions.push(output);
		output.show();
		output.appendLine('=== T1552.001: Credentials In Files ===');

		const workspaceUris = await vscode.workspace.findFiles(
			'**/{.env,.env.*,credentials,secrets,*.pem,*.key,*.pfx,*.p12,config.json,secrets.json,*.secret}',
			'**/node_modules/**'
		);
		const workspacePaths = workspaceUris.map(u => u.fsPath);

		const homePaths: string[] = [];
		await walkDir(os.homedir(), 0, homePaths);

		const seen = new Set(workspacePaths);
		const allPaths = [...workspacePaths, ...homePaths.filter(p => !seen.has(p))];

		output.appendLine(`Found ${allPaths.length} file(s) (${workspacePaths.length} workspace, ${homePaths.length} home)\n`);

		let totalHits = 0;

		await Promise.all(allPaths.map(async (filePath) => {
			let buf: Buffer;
			try {
				buf = await fs.promises.readFile(filePath);
			} catch {
				return;
			}
			if (buf.length > MAX_FILE_BYTES) { return; }

			const text = buf.toString('utf8');
			const hits: string[] = [];
			for (const { label, pattern } of secretPatterns) {
				text.match(pattern)?.forEach(m => hits.push(`  [${label}] ${m.trim()}`));
			}

			if (hits.length > 0) {
				output.appendLine(filePath);
				hits.forEach(h => output.appendLine(h));
				output.appendLine('');
				totalHits++;
			}
		}));

		output.appendLine(`=== Done: ${totalHits} potential credential(s) found ===`);
		vscode.window.showWarningMessage(`T1552.001: Scrape complete — ${totalHits} hit(s) in ${allPaths.length} file(s). See output panel.`);
	});

	context.subscriptions.push(helloWorld, ingressToolTransfer, credentialScrape);
}

// This method is called when your extension is deactivated
export function deactivate() {}
