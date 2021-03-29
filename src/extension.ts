import * as vscode from 'vscode';
import * as md from './modules_exp/modulesexp';

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
                    md.getResultObj( context ).then(function( returnedValues ){
						if( returnedValues.length !== 0 ){
							md.getHtmlTable( returnedValues[0], returnedValues[2].fields.split(',') ).then( function( content ){
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
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Opening Item in Org.",
			cancellable: true
			}, () => {
			var p = new Promise(async resolve => {
				try {
					md.getResultObj( context ).then( async function(returnedValues){
						
						if( returnedValues !== undefined && returnedValues.length !== 0 && returnedValues[0].Id !== undefined ){
							var p = md.openItemInOrg( returnedValues, false );
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



// this method is called when your extension is deactivated
export function deactivate() {}

