import { promises } from 'node:dns';
import * as vscode from 'vscode';
import * as md from './lib/modulesexp';
const cst = require('./lib/constants');

export function activate(context: vscode.ExtensionContext) {

	//Command to get the Metadata Info
	let disposable = vscode.commands.registerCommand('salesforce-md-info.getmdinfo', () => {
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Getting file info.",
			cancellable: true
			}, (progress, token) => {
				return getMdInfoHelper( context, token, false );
		});
	});

	//Command to Open item directly into Org.
	let openItemInOrgCmd = vscode.commands.registerCommand('salesforce-md-info.openiteminorg', () => {
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Opening Item in Org.",
			cancellable: true
			}, (progress, token) => {
				return openItemInOrgHelper( context, token, false );
		});
	});

	let openSelectedObjName = vscode.commands.registerCommand('salesforce-md-info.openselectedobjname', () => {
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Opening Object in Org with selected name.",
			cancellable: true
			}, (progress, token) => {
				return openItemInOrgHelper( context, token, true );
		});
	});

	let getSelectedObjNameInfo = vscode.commands.registerCommand('salesforce-md-info.getselectednameinfo', () => {
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Getting selected Object information.",
			cancellable: true
			}, (progress, token) => {
				return getMdInfoHelper( context, token, true );
		});
	});

	context.subscriptions.push(openItemInOrgCmd);
	context.subscriptions.push(disposable);
	context.subscriptions.push(openSelectedObjName);
	context.subscriptions.push(getSelectedObjNameInfo);
}


function getMdInfoHelper( context: vscode.ExtensionContext, token: vscode.CancellationToken, dynamicSobject:boolean ){
	let processCancelled = false;
	var p = new Promise(async resolve => {
		token.onCancellationRequested(() => {
			processCancelled = true;
			return resolve(false);
		});
		try {
			md.getResultObj( context, false, dynamicSobject ).then(async function( returnedValues ){
				if( returnedValues.length !== 0 && !processCancelled ){
					var fieldsList = await md.getFilteredFields( returnedValues[2] );
					md.getHtmlTable( returnedValues[0], fieldsList ).then( function( content ){
						md.createWebView( content, returnedValues, context, true ).then( function(result){
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
}


function openItemInOrgHelper( context: vscode.ExtensionContext, token: vscode.CancellationToken, dynamicSobject:boolean ){
	let processCancelled = false;
	var p = new Promise(async resolve => {
		token.onCancellationRequested(() => {
			processCancelled = true;
			return resolve(false);
		});
		try {
			md.getResultObj( context, true, dynamicSobject ).then( async function(returnedValues){
				
				if( returnedValues !== undefined && returnedValues.length !== 0 && returnedValues[0].Id !== undefined && !processCancelled ){
					var p = md.openItemInOrg( returnedValues, false, '' );
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
			vscode.window.showErrorMessage(cst.ITEM_OPENED_ERROR);
			return resolve(false);
		}
	});
	return p;
}



// this method is called when your extension is deactivated
export function deactivate() {}

