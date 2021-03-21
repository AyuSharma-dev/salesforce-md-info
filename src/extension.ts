import * as vscode from 'vscode';
const { exec } = require( 'child_process' );
const fs=require('fs');
import * as path from 'path';

var instanceUrl = undefined;

const ExtensionsToComponent = new Map([ 
	['cmp', 'AuraDefinitionBundle'],
	['auradoc', 'AuraDefinitionBundle'],
	['cmp-meta', 'AuraDefinitionBundle'],
	['design', 'AuraDefinitionBundle'],
	['js-meta', 'LightningComponentBundle'],
	['html', 'LightningComponentBundle']
]);

const apiToLabel = new Map([
	['LastModifiedBy.Name','LastModifiedBy'],
	['CreatedBy.Name','CreatedBy'],
	['Author.Name','Author'],
	['EntityDefinition.QualifiedApiName','SobjectType']
]);

const outputChannel = vscode.window.createOutputChannel('Test Suite Manager');

export function activate(context: vscode.ExtensionContext) {

	console.log('Congratulations, your extension "salesforce-md-info" is now active!');

	//Getting Instance URL:
	getInstanceUrl().then( function( instUrl ){
		instanceUrl = instUrl;
		console.log('instanceUrlonce-->'+instanceUrl);
	});	
	var ed = vscode.window.activeTextEditor;
	console.log('filenameonce-->'+ed.document.fileName);

	let disposable = vscode.commands.registerCommand('salesforce-md-info.getmdinfo', () => {

		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Getting file info.",
			cancellable: false
			}, () => {
			var p = new Promise(async resolve => {
				try {
                    console.log(context.extensionPath + "\\src\\dataInfos.json");
                    var importedData = JSON.parse(fs.readFileSync(context.extensionPath + "\\src\\dataInfos.json", 'utf8'));

					var editorInfo = vscode.window.activeTextEditor;
					var fileFullNameList = editorInfo.document.fileName.substring(editorInfo.document.fileName.lastIndexOf('\\') + 1).split('.');
					var fileName = undefined, fileExtension = undefined;
					if( fileFullNameList.length > 3 ){
						fileName = fileFullNameList[1];
						fileExtension = fileFullNameList[2];
					}
					else{
						fileName = fileFullNameList[0];
						fileExtension = fileFullNameList[1];
					}
					console.log('fileName-->'+fileName+'--Ext-->'+fileExtension);
					var extObj = undefined;
					new Promise( resolve=>{
						if( fileExtension === 'js' || fileExtension === 'css' ){
							getComponentTypeSelected().then( function( newFileExt ){
								getComponentActualName( fileName ).then( function(resultName){
									fileName = resultName;
									extObj = importedData[ newFileExt ];
									return resolve(true);
								})
							});
						}
						else{
							if( ExtensionsToComponent.get( fileExtension ) != undefined ){
								fileExtension = ExtensionsToComponent.get( fileExtension );
							}
							extObj = importedData[fileExtension];
							return resolve(true);
						}
					}).then(function(result){
						if( extObj == undefined ){
							vscode.window.showErrorMessage("This data type is not supported.");
							return resolve(false);
						}
					}).then( function(result){
						if( extObj != undefined ){
							const query = "\"Select "+extObj.fields+" From "+extObj.objectName+" Where "+extObj.searchField+" = "+"\'"+fileName+"\'"+" \"";
							var queryForMD = "sfdx force:data:soql:query --json -t -q "+query;
							console.log( 'query-->'+query );
							getDataInfo( queryForMD ).then( function( mdInfo ){
		
								if( mdInfo.status != 0 ){
									vscode.window.showErrorMessage("Error occurred when fetching information.");
									outputChannel.append( mdInfo.message );
									outputChannel.show();	
									return resolve(false);
								}
		
								//Raising error if no data returned.
								if( mdInfo.result.records == undefined || mdInfo.result.records.length == 0 ){
									vscode.window.showErrorMessage("No data found with this name in Org. Either its deleted or you don't have access to it.");
									return resolve(false);
								}
		
								var returnedObject = undefined;
		
								//If there are more then one record found then assigning the Last one.
								if( mdInfo.result.records.length > 1 ){
									returnedObject = mdInfo.result.records[ mdInfo.result.records.length - 1 ];
								}
								else{
									returnedObject = mdInfo.result.records[0];
								}
		
								getHtmlTable( returnedObject, extObj.fields.split(',') ).then( function( content ){
									console.log('content-->'+content);
									createWebView( content, fileName, returnedObject.Id, context ).then( function( result ){
										return resolve( true );
									} );
								} );
							})
						}
					});
				}
				catch (error) {
					console.log( 'Error occured: '+error.message+'----'+error.stack );
					vscode.window.showErrorMessage("Error occured.");
					return resolve(false);
				}
			});
			return p;
		});
	});

	context.subscriptions.push(disposable);
}


function getComponentTypeSelected(){
	return new Promise( async resolve=>{
		var choice = await vscode.window.showInformationMessage("Please let us know the Type of Component, it's a:", "Aura Component", "Lightning Web Component");
		if (choice === "Aura Component") {
			return resolve("AuraDefinitionBundle");
		}
		else if( choice === "Lightning Web Component" ){
			return resolve("LightningComponentBundle");
		}
	});
}


function getComponentActualName( fileName ){

	return new Promise( resolve=>{
		const fileNameUpperCase = fileName.toUpperCase();
		if( fileNameUpperCase.endsWith('CONTROLLER') ){
			console.log('inside controllerLogic-->'+fileNameUpperCase.substring( 0, fileNameUpperCase.lastIndexOf( 'CONTROLLER' ) ));
			fileName = fileNameUpperCase.substring( 0, fileNameUpperCase.lastIndexOf( 'CONTROLLER' ) );
		}
		else if( fileNameUpperCase.endsWith('HELPER') ){
			fileName = fileNameUpperCase.substring( 0, fileNameUpperCase.lastIndexOf( 'HELPER' ) );
		}
		else if( fileNameUpperCase.endsWith('RENDERER') ){
			fileName = fileNameUpperCase.substring( 0, fileNameUpperCase.lastIndexOf( 'RENDERER' ) );
		}
		console.log('fileName returned-->'+fileName);
		return resolve( fileName );
	});

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
		let urlOpenImage = vscode.Uri.file(path.join(context.extensionPath, 'Images/openinorg.png')).with({
			scheme: "vscode-resource"
		}).toString();
		currentPanel.webview.html = getWebviewContent(content,urlOpenImage);
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
		return resolve( currentPanel );
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
						return resolve( instanceUrl );
					});	
				}
				else{
					return resolve( instanceUrl );
				}
			});
			p.then( function( instanceUrl ){
				
				console.log('this is my Name-->'+context.globalState.get( 'Name' ));
				vscode.env.openExternal(vscode.Uri.parse(instanceUrl+'/'+mdId));
				return resolve2( true );
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
				return resolve( resultObj.result.instanceUrl );
			}
			else{
				vscode.window.showErrorMessage('Problem occurred in getting org info.');
				return resolve( false );
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
			console.log('items-->'+outputJson);
			return resolve( JSON.parse(outputJson) );
		});
	});
}


function getHtmlTable( returnedObj, fieldsList ){

	return new Promise( resolve=> {
		let content = `<table id="customers">
							<tr>
								<th width="50%">Field</th>
								<th width="150%">Value</th>
							</tr>`;
		for( var i = 0; i<fieldsList.length; i++ ){
			var fieldName = fieldsList[i];
			if( fieldName.includes('.') ){
				content += `<tr><td>${apiToLabel.get(fieldName)}</td>`;
				fieldName = fieldName.split('.');
				console.log( 'fieldName-->'+fieldName );
				if( returnedObj[fieldName[0]] != null ){
                    content += `<td>${returnedObj[fieldName[0]][fieldName[1]]}</td></tr>`;
                }
                else{
                    content += `<td>null</td></tr>`;
                }
			}
			else{
				content += `<tr><td>${fieldName}</td>`;
				content += `<td>${returnedObj[fieldName]}</td></tr>`;
			}
		}
		content += '</table>';
		return resolve( content );
	} );
}


function getWebviewContent( content, urlOpenImage ){
	return `<!DOCTYPE html>
	<html lang="en">
	<style>
		
	  #customers {
		background-color:#2C2C32;
		border-collapse: collapse;
		margin-top: 5%;
		font-family: sans-serif;
		font-size: 120%;
		float: left;
		margin-right: 1%;
		display: inline-block;
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
	
	
	#customers td {
		padding-top: 10px;
		padding-bottom: 10px;
		font-weight: 400;
		text-align: left;
		wi
	}
	.button2{
		font-family: "Segoe UI","Helvetica Neue","Helvetica",Arial,sans-serif;
		font-weight: 400;
		font-size: 12px;
		color: white;
		background-color:#0066B8;
		cursor: pointer;
		margin-top: 5%;
		float: left;
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
		${content}
		<input type="image" class="button2" src="${urlOpenImage}" alt="Submit" width="40" height="40" onclick=pushToOpenInOrg(this) title="Open Item in Org.">
	</body>
	</html>`;

}

//"https://drive.google.com/uc?export=view&id=1JUJzQRF0bDUz4N5XfTTcDp5iZLzda2V-"
// this method is called when your extension is deactivated
export function deactivate() {}
