import * as vscode from 'vscode';
const { exec } = require( 'child_process' );
const fs=require('fs');
import * as path from 'path';
import {toolingAPIObject} from './toolingAPIObject';

var currentPanel:any;

const extensionsToComponent = new Map([ 
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

	//Command to get the Metadata Info
	let disposable = vscode.commands.registerCommand('salesforce-md-info.getmdinfo', () => {

		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Getting file info.",
			cancellable: true
			}, () => {
			var p = new Promise(async resolve => {
				try {
                    getResultObj( context ).then(function( returnedValues ){
						JSON.stringify( 'rVal-->'+JSON.stringify(returnedValues) );
						if( returnedValues.length !== 0 ){
							getHtmlTable( returnedValues[0], returnedValues[2].fields.split(',') ).then( function( content ){
								createWebView( content, returnedValues[1], returnedValues[0].Id, context, true ).then( function(result){
									return resolve( result );
								});
							});
						}
						else{
							console.log('Something went Wrong.');
							return resolve(false);
						}
					});
				}
				catch (error) {
					console.log( 'Error occurred: '+error.message+'----'+error.stack );
					vscode.window.showErrorMessage("Error occurred.");
					return resolve(false);
				}
			});
			return p;
		});
	});

	//Command to Open item directly into Org.
	let openItemInOrgCmd = vscode.commands.registerCommand('salesforce-md-info.openiteminorg', () => {
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Opening Item in Org.",
			cancellable: true
			}, () => {
			var p = new Promise(async resolve => {
				try {
					getResultObj( context ).then( function(returnedValues){
						
						if( returnedValues !== undefined && returnedValues.length !== 0 && returnedValues[0].Id !== undefined ){
							var p = openItemInOrg( returnedValues[0].Id, false );
							if( p !== undefined ){
								p.then(function( result ){
									return resolve(true);
								});
							}
						}
						else{
							return resolve(false);
						}
					});
				}
				catch( error ){
					console.log('error Occurred: '+error.stack);
					vscode.window.showErrorMessage('Not able to open this item in Org.');
					return resolve(false);
				}
			});
			return p;
		});
	});

	context.subscriptions.push(openItemInOrgCmd);
	context.subscriptions.push(disposable);
}

//Method Returns the Metadata object details.
function getResultObj( context:vscode.ExtensionContext ):Promise<any[]>{
	var fileName:string;
	return new Promise(resolve=>{
		getFileNameAndExtension().then(function(fileInfo){
			console.log('fileName=>'+fileInfo[1]+'---'+'fileExt-->'+fileInfo[0]);
			fileName = fileInfo[1];
			getExtObj( fileInfo[0], fileInfo[1], context ).then( function( extObject ){
				console.log('extObj-->'+JSON.stringify(extObject));
				return extObject;

			}).then(function(extObj){
				if( extObj === undefined ){
					vscode.window.showErrorMessage("This data type is not supported.");
					return resolve([]);
				}
				else{
					const query = "\"Select "+extObj.fields+" From "+extObj.objectName+" Where "+extObj.searchField+" = "+"\'"+fileName+"\'"+" \"";
					var queryForMD = "sfdx force:data:soql:query --json -t -q "+query;
					console.log( 'query-->'+query );
					runCommand( queryForMD, true ).then( function( mdInfo ){

						if( mdInfo.status !== 0 ){
							vscode.window.showErrorMessage("Error occurred when fetching information.");
							outputChannel.append( mdInfo.message );
							outputChannel.show();	
							return resolve([]);
						}

						//Raising error if no data returned.
						if( mdInfo.result.records === undefined || mdInfo.result.records.length === 0 ){
							vscode.window.showErrorMessage("No data found with this name in Org. Either its deleted or you don't have access to it.");
							return resolve([]);
						}

						var returnedObject:any;

						//If there are more then one record found then assigning the Last one.
						if( mdInfo.result.records.length > 1 ){
							returnedObject = mdInfo.result.records[ mdInfo.result.records.length - 1 ];
							return resolve([returnedObject, fileName, extObj]);
						}
						else{
							returnedObject = mdInfo.result.records[0];
							return resolve([returnedObject, fileName, extObj]);
						}
					});
				}
			});
		});
	});

}

//Method reads and returns active/selected File Name and Extension.
function getFileNameAndExtension():Promise<any[]>{

	return new Promise( resolve=>{
		var editorInfo = vscode.window.activeTextEditor;

		if( editorInfo === undefined ){
			return resolve([]);
		}

		var fileFullNameList = editorInfo.document.fileName.substring(editorInfo.document.fileName.lastIndexOf('\\') + 1).split('.');
		var fileName:string, fileExtension:string;
		if( fileFullNameList.length > 3 ){
			fileName = fileFullNameList[1];
			fileExtension = fileFullNameList[2];
		}
		else{
			fileName = fileFullNameList[0];
			fileExtension = fileFullNameList[1];
		}
		return resolve( [fileExtension, fileName] );
	});

}

//Method returns the Object MD which matches the Extension will be used to create Query.
function getExtObj( fileExtension:string, fileName:string, context:vscode.ExtensionContext ):
	Promise<{ objectName:string, fields:string, searchField:string }>{

	var importedData = JSON.parse(fs.readFileSync(context.extensionPath + "\\src\\dataInfos.json", 'utf8'));

	var extObj:{ objectName:string, fields:string, searchField:string };

	return new Promise( resolve=>{
		if( fileExtension === 'js' || fileExtension === 'css' ){
			getComponentTypeSelected().then( function( newFileExt:string ){
				getComponentActualName( fileName ).then( function(resultName){
					fileName = resultName;
					extObj = importedData[ newFileExt ];
					return resolve(extObj);
				});
			});
		}
		else{
			var ext:string|undefined = extensionsToComponent.get( fileExtension );
			if( ext === undefined ){
				extObj = importedData[fileExtension];
			}
			else{
				extObj = importedData[ext];
			}
			return resolve(extObj);
		}
	});

}

//If selected file is JS then give option for Aura/LWC.
function getComponentTypeSelected():Promise<string>{
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

//Get the Actual name of Component which may have multiple extensions.
function getComponentActualName( fileName:string ):Promise<string>{

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

//Method generated the Web view from the Passed Content.
function createWebView( content:string, tabName:string, mdId:string, context:vscode.ExtensionContext, createPanel:boolean ){
	return new Promise( resolve=>{
		var tabLabel = tabName+' Details';
		tabName = tabName+'detail';

		if( createPanel ){
			currentPanel = vscode.window.createWebviewPanel(
				tabName,
				tabLabel,
				vscode.ViewColumn.One,
				{
					enableScripts: true
				}
			);

			currentPanel.webview.onDidReceiveMessage(
				(			
					message: { text: string; command: any; }) => {
					var selectedItems = message.text.split(' ');
					selectedItems.pop();
					switch (message.command) {
						case 'open_in_org':
							openItemInOrg( mdId, true );
						case 'refresh_information':
							createWebView( content, tabName.slice( 0, tabName.lastIndexOf('detail') ), mdId, context, false );
					}
				},
				undefined
			);
		}
		let urlOpenImage = vscode.Uri.file(path.join(context.extensionPath, 'Images/openinorg.png')).with({
			scheme: "vscode-resource"
		}).toString();
		let refreshIcon = vscode.Uri.file(path.join(context.extensionPath, 'Images/whiteRefresh.png')).with({
			scheme: "vscode-resource"
		}).toString();
		
		currentPanel.webview.html = getWebviewContent(content,urlOpenImage,refreshIcon);
		return resolve( currentPanel );
	} );

}

//Method Opens the Item into Org.
function openItemInOrg( mdId:string, showProgress:boolean ){

	if(showProgress){
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Opening item in Org.",
			cancellable: true
			}, () => {
			var p2 = new Promise( resolve2 =>{
				let command:string = "sfdx force:org:open -p /"+mdId;
				runCommand( command, false ).then(function(result){
					vscode.window.showInformationMessage('Item Opened in Org Successfully.');
					return resolve2(true);
				});
			} );
			return p2;
		});
	}
	else{
		var p2 = new Promise( resolve2 =>{
			let command:string = "sfdx force:org:open -p /"+mdId;
			runCommand( command, false ).then(function(result){
				vscode.window.showInformationMessage('Item Opened in Org Successfully.');
				return resolve2( true );
			});
		});
		return p2;
	}	
}

//Method runs the Passed command into the Terminal with SFDX directory.
function runCommand( command:string, readOutput:boolean ):Promise<toolingAPIObject.RootObject>{

	return new Promise(resolve=>{
		var outputJson = '';
		//let currentPanel: vscode.WebviewPanel | undefined = undefined;
		if( vscode.workspace.workspaceFolders === undefined ){
			return;
		}
		let foo = exec( command,{
			maxBuffer: 1024 * 1024 * 6,
			cwd: vscode.workspace.workspaceFolders[0].uri.fsPath
		});

		foo.stdout.on("data",(dataArg:string)=> {
			try{
				outputJson += dataArg;
			}
			catch( err ){
				console.log( 'err-->'+err.message );
			}
		});

		foo.on('close', (data:string)=> {
			console.log('items-->'+outputJson);
			if( readOutput ){
				return resolve( JSON.parse(outputJson) );
			}
			else{
				return resolve(JSON.parse('{"Not":"Required"}'));
			}
			
		});
		
	});
}

//Method creates the Table with Dynamic fields to show the Metadata Details.
function getHtmlTable( returnedObj:{[key:string]: toolingAPIObject.Record}, fieldsList:string[] ):Promise<string>{

	return new Promise( resolve=> {
		let content = `<table id="customers">
							<tr>
								<th width="250px">Field</th>
								<th width="450px">Value</th>
							</tr>`;
		for( var i = 0; i<fieldsList.length; i++ ){
			var fieldName:string = fieldsList[i];
			if( fieldName.includes('.') ){
				content += `<tr><td>${apiToLabel.get(fieldName)}</td>`;
				const fieldsList = fieldName.split('.');
				console.log( 'fieldsList-->'+fieldsList );
				var recordValLevelOne:any = returnedObj[fieldsList[0]];
				if( recordValLevelOne !== null ){
                    content += `<td>${recordValLevelOne[fieldsList[1]]}</td></tr>`;
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

//Method returns the HTML which will be set on the Web View.
function getWebviewContent( content:string, urlOpenImage:string, refreshIcon:string ){
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
		display: inline-block;
		width:700px;
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
	ul{
		display: table-caption;
		margin-top: 60%;
		margin-left: -30%;
		list-style: none;
	}
	</style>
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>Metadata Info</title>
	</head>
	<script>
		const vscode = acquireVsCodeApi();

		var pushToOpenInOrg = function(object) {
			vscode.postMessage({
				command: 'open_in_org',
				text: 'Open in Org'
			})
		}

		var refreshInfo = function(object) {
			vscode.postMessage({
				command: 'refresh_information',
				text: 'Refresh Information'
			})
		}
	</script>
	<body>
		${content}

		<ul>
			<li>
				<input type="image" class="button2" src="${urlOpenImage}" alt="Submit" width="40" height="40" onclick=pushToOpenInOrg(this) title="Open Item in Org.">
			</li>
			<li style="margin-top: 20px;">	
				<!--<input type="image" class="button2" src="${refreshIcon}" alt="Submit" width="40" height="40" onclick=refreshInfo(this) title="Open Item in Org.">-->
			</li>
		</ul>	
	</body>
	</html>`;

}

// this method is called when your extension is deactivated
export function deactivate() {}

