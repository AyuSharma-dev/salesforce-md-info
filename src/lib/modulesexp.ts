const { exec } = require( 'child_process' );
const fs=require('fs');
import * as path from 'path';
import {toolingAPIObject} from '../toolingAPIObject';
import * as vscode from 'vscode';
const cst = require('./constants');

var currentPanel:any;

const extensionsToComponent = cst.EXTENSION_TO_CMP_MAP;

const apiToLabel = cst.API_TO_LABEL;

const outputChannel = vscode.window.createOutputChannel('Metadata Info');

//Method Returns the Metadata object details.
export function getResultObj( context:vscode.ExtensionContext, openInOrgOnly:boolean ):Promise<any[]>{
	var fileName:string;
	var extObj:any;
	return new Promise(resolve=>{
		getFileNameAndExtension().then(async function(fileInfo){
			fileName = fileInfo[1].toUpperCase();
			var fileExt = fileInfo[0];
			//Checking if object is Standard
			if( fileExt === cst.OBJECT_EXT && !fileName.includes(cst.POST_FIX) 
				&& !fileName.includes(cst.POST_FIX2) ){
				if( !openInOrgOnly ){
					vscode.window.showErrorMessage(cst.STANDARD_OBJ_ERROR);
					return resolve([]);
				}
				else{
					if( await isLightningDefault() ){
						await openItemInOrg( [], false, '/lightning/setup/ObjectManager/'+fileInfo[1]+'/view' );
						return resolve([]);
					}
					else{
						await openItemInOrg( [], false, '/ui/setup/Setup?setupid='+fileInfo[1] );
						return resolve([]);
					}
				}
				
			}
			removePreAndPostFixes( fileName ).then( function( filteredFileName ){
				fileName = filteredFileName;
			}).then(
				function( result ){
					console.log( fileInfo[0], fileInfo[1] );
					getExtObj( fileInfo[0], fileInfo[1], context ).then( function( extObject ){
						extObj = extObject[0];
						if( extObject[1] !== '' ){
							fileName = extObject[1];
						}
						return extObject;
		
					}).then(function(result){
						if( extObj === undefined ){
							vscode.window.showErrorMessage(cst.DATA_NOT_SUPPORTED_ERROR);
							return resolve([]);
						}
						else{
							let useToolingAPI = '-t';

							if( extObj.objectName === 'RecordType' ){
								useToolingAPI = '';
							}
							if( extObj.objectName === 'Layout' ){
								fileName = fileName.substring( fileName.indexOf('-')+1 );
							}

							const query = "\"Select "+extObj.fields+" From "+extObj.objectName+" Where "+extObj.searchField+" = "+"\'"+fileName+"\'"+"LIMIT 1 \"";
							var queryForMD = cst.QUERY_CMD+" --json "+useToolingAPI+" -q "+query;
							runCommand( queryForMD, true ).then( function( mdInfo ){
		
								if( mdInfo.status !== 0 ){
									vscode.window.showErrorMessage(cst.FETCHING_ERROR);
									outputChannel.append( mdInfo.message );
									outputChannel.show();	
									return resolve([]);
								}
		
								//Raising error if no data returned.
								if( mdInfo.result.records === undefined || mdInfo.result.records.length === 0 ){
									vscode.window.showErrorMessage(cst.NO_DATA_FOUND_ERROR);
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
				}
			);
		});
	});

}

//Method removes Prefix and PostFix of elements.
function removePreAndPostFixes( fileName:string ):Promise<string>{
	return new Promise(resolve=>{
		if( fileName.includes(cst.DOUBLE_UNS) ){
			if( fileName.endsWith(cst.POST_FIX) || fileName.endsWith(cst.POST_FIX2) ){
				var nameList = fileName.split(cst.DOUBLE_UNS);
				fileName = nameList[ nameList.length - 2 ];
			}
			else{
				fileName = fileName.substring( fileName.lastIndexOf(cst.DOUBLE_UNS)+2 );
			}
			return resolve( fileName );
		}
		else{
			return resolve( fileName );
		}
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
	Promise<[{ objectName:string, fields:string, searchField:string }, string]>{

	var importedData = JSON.parse(fs.readFileSync(context.extensionPath + cst.JSON_DATA_PATH, 'utf8'));

	var extObj:{ objectName:string, fields:string, searchField:string };

	return new Promise( resolve=>{
		if( fileExtension === 'js' || fileExtension === 'css' ){
			getComponentTypeSelected().then( function( newFileExt:string ){
				getComponentActualName( fileName ).then( function(resultName){
					fileName = resultName;
					extObj = importedData[ newFileExt.toLowerCase() ];
					return resolve([extObj, fileName]);
				});
			});
		}
		else{
			var ext:string|undefined = extensionsToComponent.get( fileExtension );
			if( ext === undefined ){
				extObj = importedData[fileExtension.toLowerCase()];
			}
			else{
				extObj = importedData[ext.toLowerCase()];
			}
			return resolve([extObj, '']);
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
			fileName = fileNameUpperCase.substring( 0, fileNameUpperCase.lastIndexOf( 'CONTROLLER' ) );
		}
		else if( fileNameUpperCase.endsWith('HELPER') ){
			fileName = fileNameUpperCase.substring( 0, fileNameUpperCase.lastIndexOf( 'HELPER' ) );
		}
		else if( fileNameUpperCase.endsWith('RENDERER') ){
			fileName = fileNameUpperCase.substring( 0, fileNameUpperCase.lastIndexOf( 'RENDERER' ) );
		}
		return resolve( fileName );
	});

}

//Method generated the Web view from the Passed Content.
export function createWebView( content:string, returnedValues:any, context:vscode.ExtensionContext, createPanel:boolean ){
	return new Promise( resolve=>{
		var tabName = returnedValues[1]+'detail';
		var tabLabel = returnedValues[1]+' Details';

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
							openItemInOrg( returnedValues, true, '' );
						case 'refresh_information':
							createWebView( content, returnedValues, context, false );
					}
				},
				undefined
			);
		}
		let urlOpenImage = vscode.Uri.file(path.join(context.extensionPath, 'media', cst.IMG_PATH1)).with({
			scheme: "vscode-resource"
		}).toString();
		let refreshIcon = vscode.Uri.file(path.join(context.extensionPath,'media', cst.IMG_PATH2)).with({
			scheme: "vscode-resource"
		}).toString();
		
		currentPanel.webview.html = getWebviewContent(content,urlOpenImage,refreshIcon);
		return resolve( currentPanel );
	} );

}

//Method Opens the Item into Org.
export async function openItemInOrg( returnedValues:any, showProgress:boolean, redUrl:string ){
	if( redUrl === '' ){
		redUrl = await getRedirectURL( returnedValues );
	}

	if( redUrl === "" ){
		return;
	}

	if(showProgress){
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Opening item in Org.",
			cancellable: true
			}, () => {
			var p2 = new Promise( async resolve2 =>{
				let command:string = cst.OPEN_URL_CMD+" -p /"+redUrl;
				runCommand( command, false ).then(function(result){
					vscode.window.showInformationMessage(cst.ITEM_OPENED_SUCCESS);
					return resolve2(true);
				});
			} );
			return p2;
		});
	}
	else{
		var p2 = new Promise( resolve2 =>{
			let command:string = cst.OPEN_URL_CMD+" -p /"+redUrl;
			runCommand( command, false ).then(function(result){
				vscode.window.showInformationMessage(cst.ITEM_OPENED_SUCCESS);
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
			if( readOutput ){
				return resolve( JSON.parse(outputJson) );
			}
			else{
				return resolve(JSON.parse('{"Not":"Required"}'));
			}
			
		});
		
	});
}


//Method returns the redirect URL after modification.
export function getRedirectURL( returnedValues:any ):Promise<string>{
	return new Promise(async resolve=>{
		let extObj = returnedValues[2];
		let rec = returnedValues[0];
		
		if( await isLightningDefault() && returnedValues[2].redirectUrlLtng !== undefined ){
			var ltngURL:string = returnedValues[2].redirectUrlLtng;
			if( ltngURL.includes( "RECORD_ID_HERE" ) ){
				ltngURL = ltngURL.replace( "RECORD_ID_HERE", rec.Id );
			}
			if( ltngURL.includes( "OBJECT_ID_HERE" ) ){
				ltngURL = ltngURL.replace( "OBJECT_ID_HERE", rec.EntityDefinitionId );
			}
			else{
				ltngURL += rec.Id;
			}
			console.log('ltngURL-->'+ltngURL);
			return resolve( ltngURL );
		}
		else{
			let objUrlKey;
			if( extObj.urlKey !== undefined ){
				objUrlKey = rec[extObj.urlKey];
			}
			else{
				objUrlKey = rec.Id;
			}

			if( returnedValues[2].redirectUrl !== undefined ){
				objUrlKey = returnedValues[2].redirectUrl+objUrlKey;
			}

			if( returnedValues[2].redirectUrlLtng === undefined ){
				var choice = await vscode.window.showInformationMessage("This item cannot be opened in lightning, open in classic?", "Yes", "No");
				if (choice === "Yes") {
					return resolve(objUrlKey);
				}
				else if( choice === "No" ){
					return resolve("");
				}
			}
			else{
				return resolve(objUrlKey);
			}
		}
		
	});
}


function isLightningDefault():Promise<Boolean>{

	return new Promise(resolve=>{
		const workspaceConfig: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(
			'extension.sfmdi'
		);
		const isLightningDefault: boolean = Boolean( workspaceConfig.get('explorer.OpenURLInLightning') );
		
		resolve( isLightningDefault );
	});

}


//Method creates the Table with Dynamic fields to show the Metadata Details.
export function getHtmlTable( returnedObj:{[key:string]: toolingAPIObject.Record}, fieldsList:string[] ):Promise<string>{

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


export function getFilteredFields( exObject:any ):Promise<string[]>{

	return new Promise(resolve=>{ 
		var fieldsArray = exObject.fields.split( ',' );
		if( exObject.fieldsToHide !== undefined ){
			const hiddenFieldsArray:string[] = exObject.fieldsToHide.split(',');
			for( var i=0; i<hiddenFieldsArray.length; i++ ){
				fieldsArray.splice(fieldsArray.indexOf( hiddenFieldsArray[i] ), 1);
			}
			return resolve( fieldsArray );
		}
		else{
			return resolve( fieldsArray );
		}
	});

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