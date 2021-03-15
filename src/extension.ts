import * as vscode from 'vscode';
const { exec } = require( 'child_process' );
var instanceUrl = undefined;

let extensionMap = new Map([
	['cls', 'ApexClass']
]);

export function activate(context: vscode.ExtensionContext) {

	console.log('Congratulations, your extension "salesforce-md-info" is now active!');

	//Getting Instance URL:
	getInstanceUrl().then( function( instUrl ){
		instanceUrl = instUrl;
		console.log('instanceUrlonce-->'+instanceUrl);
	});	
	var ed = vscode.window.activeTextEditor;
	console.log('filenameonce-->'+ed.document.fileName);

	let disposable = vscode.commands.registerCommand('salesforce-md-info.helloWorld', () => {

		var mdName = 'AccountController';
		context.globalState.update( 'Name', 'Ayush' );
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Getting file info.",
			cancellable: false
			}, () => {
			var p = new Promise(resolve => {
				var editorInfo = vscode.window.activeTextEditor;
				var fileFullName = editorInfo.document.fileName.substring( editorInfo.document.fileName.lastIndexOf('\\') + 1 );
				const fileName = fileFullName.split('.')[0];
				const fileExtension = fileFullName.split('.')[1];
				console.log('filename-->'+fileName+'----'+'extension-->'+fileExtension);

				if( extensionMap.get(fileExtension) == undefined ){
					vscode.window.showErrorMessage("This data type is not supported.");
					resolve(false);
				}
				const fields = ' Id, Name, LastModifiedBy.Name, CreatedDate, CreatedBy.Name, LastModifiedDate ';
				const query = "\"Select"+fields+"From "+extensionMap.get(fileExtension)+" Where Name ="+"\'"+mdName+"\'"+" \"";
				var queryForMD = "sfdx force:data:soql:query --json -q "+query;

				getDataInfo( queryForMD ).then( function( mdInfo ){
					getHtmlTable( mdInfo ).then( function( content ){
						console.log('content-->'+content);
						createWebView( content, mdName, mdInfo.result.records[0].Id, context ).then( function( result ){
							resolve( true );
						} );
					} );
				})

			});
			return p;
		});
	});

	context.subscriptions.push(disposable);
}


function createWebView( content, tabName, mdId, context ){
	return new Promise( resolve=>{
		let currentPanel = undefined;
		tabName = tabName+'detail';
		var tabLabel = tabName+' Details';

		currentPanel = vscode.window.createWebviewPanel(
			tabName,
			tabLabel,
			vscode.ViewColumn.One,
			{
				enableScripts: true
			}
		);
		currentPanel.webview.html = getWebviewContent(content);
		currentPanel.webview.onDidReceiveMessage(
			message => {
				var selectedItems = message.text.split(' ');
				selectedItems.pop();
				switch (message.command) {
					case 'open_in_org':
						return openItemInOrg( mdId, context );
				}
			},
			undefined
		);
		resolve( currentPanel );
	} );

}


function openItemInOrg( mdId, context ){

	vscode.window.withProgress({
		location: vscode.ProgressLocation.Notification,
		title: "Opening item in Org.",
		cancellable: false
		}, () => {
		var p2 = new Promise( resolve2 =>{
			var p = new Promise( resolve=>{
				if( instanceUrl == undefined ){
					getInstanceUrl().then( function( instUrl ){
						instanceUrl = instUrl;
						resolve( instanceUrl );
					});	
				}
				else{
					resolve( instanceUrl );
				}
			});
			p.then( function( instanceUrl ){
				
				console.log('this is my Name-->'+context.globalState.get( 'Name' ));
				vscode.env.openExternal(vscode.Uri.parse(instanceUrl+'/'+mdId));
				resolve2( true );
			});
		} );
		return p2
	});
	
}


function getInstanceUrl(){

	return new Promise( resolve => {
		let command = "sfdx force:org:display --json";
		getDataInfo( command ).then( function( resultObj ){
			console.log( 'status-->'+resultObj.status );
			if( resultObj.status == 0 ){
				resolve( resultObj.result.instanceUrl );
			}
			else{
				vscode.window.showErrorMessage('Problem occurred in getting org info.');
				resolve( false );
			}
		});
	});
}


function getDataInfo( command ){

	return new Promise(resolve=>{
		var outputJson = '';
		//let currentPanel: vscode.WebviewPanel | undefined = undefined;
		let foo = exec( command,{
			maxBuffer: 1024 * 1024 * 6,
			cwd: vscode.workspace.workspaceFolders[0].uri.fsPath
		});

		foo.stdout.on("data",(dataArg)=> {
			try{
				outputJson += dataArg;
			}
			catch( err ){
				console.log( 'err-->'+err.message );
			}
		});

		foo.on('close', (data)=> {
			console.log('data-->'+data);
			console.log('items-->'+outputJson);
			resolve( JSON.parse(outputJson) );
		});
	});
}


function getHtmlTable( mdInfo ){

	return new Promise( resolve=> {
		let content = `	<table id="customers" style="width:50%">
							<tr>
								<th>Field</th>
								<th>Value</th>
							</tr>
							<tr>
								<td>Component Name</td>
								<td>${mdInfo.result.records[0].Name}</td>
							</tr>
							<tr>
								<td>Last Modified By</td>
								<td>${mdInfo.result.records[0].LastModifiedBy.Name}</td>
							</tr>
							<tr>
								<td>Created By</td>
								<td>${mdInfo.result.records[0].CreatedBy.Name}</td>
							</tr>
							<tr>
								<td>Last Modified Date</td>
								<td>${mdInfo.result.records[0].LastModifiedDate}</td>
							</tr>
							<tr>
								<td>Created Date</td>
								<td>${mdInfo.result.records[0].CreatedDate}</td>
							</tr>
						</table>`;
		resolve( content );
	} );
}


function getWebviewContent( content ){
	return `<!DOCTYPE html>
	<html lang="en">
	<style>
		#customers {
			background-color:#2C2C32;
			border-collapse: collapse;
			width: 100%;
			margin-top: 5%;
			font-family: sans-serif;
			font-size: 120%;
		}
		
		#customers td, #customers th {
			border: 1px solid #222;
			padding: 8px;
			color:white;
		}
		
		#customers tr:hover {background-color: #222;}
		
		#customers th {
			padding-top: 12px;
			padding-bottom: 12px;
			font-weight: 600;
			text-align: left;
			background-color: #0066B8;
			color: white;
		}
		.button2{
			font-family: "Segoe UI","Helvetica Neue","Helvetica",Arial,sans-serif;
			font-weight: 600;
			font-size: 20px;
			padding: 10px 20px;
			display: inline-block;
			color: white;
			background-color:#0066B8;
			cursor: pointer;
		}
	</style>
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>Metadata Info</title>
	</head>
	<script>
		var pushToOpenInOrg = function(object) {
			const vscode = acquireVsCodeApi();
			vscode.postMessage({
				command: 'open_in_org',
				text: 'Open in Org'
			})
		}
	</script>
	<body>
		<div>
			${content}
		</div>
		<br/>
		<button class="button2" onclick="pushToOpenInOrg(this)">Open in Org</button>
	</body>
	</html>`;

}

// this method is called when your extension is deactivated
export function deactivate() {}
