import * as vscode from 'vscode';
import * as md from './lib/modulesexp';
const cst = require('./lib/constants');

export function activate(context: vscode.ExtensionContext) {

	//Command to get the Metadata Info
	let disposable = vscode.commands.registerCommand('salesforce-md-info.getmdinfo', () => {
		let processCancelled = false;
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Getting file info.",
			cancellable: true
			}, (progress, token) => {
			var p = new Promise(async resolve => {
				token.onCancellationRequested(() => {
					console.log("User canceled the long running operation");
					processCancelled = true;
					return resolve(false);
				});
				try {
                    md.getResultObj( context, false ).then(async function( returnedValues ){
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
		});
	});

	//Command to Open item directly into Org.
	let openItemInOrgCmd = vscode.commands.registerCommand('salesforce-md-info.openiteminorg', () => {
		let processCancelled = false;
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Opening Item in Org.",
			cancellable: true
			}, (progress, token) => {
			var p = new Promise(async resolve => {
				token.onCancellationRequested(() => {
					console.log("User canceled the long running operation");
					processCancelled = true;
					return resolve(false);
				});
				try {
					md.getResultObj( context, true ).then( async function(returnedValues){
						
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
		});
	});

	context.subscriptions.push(openItemInOrgCmd);
	context.subscriptions.push(disposable);
}



// this method is called when your extension is deactivated
export function deactivate() {}

