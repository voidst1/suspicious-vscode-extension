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

	context.subscriptions.push(helloWorld, ingressToolTransfer);
}

// This method is called when your extension is deactivated
export function deactivate() {}
