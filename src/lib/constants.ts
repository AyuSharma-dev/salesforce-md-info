/* eslint-disable @typescript-eslint/naming-convention */
module.exports = Object.freeze({
    STANDARD_OBJ_ERROR: "This extension does not support this command Standard Objects right now.",
    DATA_NOT_SUPPORTED_ERROR: "This data type is not supported.",
    FETCHING_ERROR: "Error occurred when fetching information.",
    NO_DATA_FOUND_ERROR: "No data found with this name in Org. Either its deleted or you don't have access to it.",
    ITEM_OPENED_ERROR: "Not able to open this item in Org.",

    ITEM_OPENED_SUCCESS: "Item Opened in Org Successfully.",

    OBJECT_EXT:'object-meta',

    QUERY_CMD: "sfdx force:data:soql:query",
    OPEN_URL_CMD: "sfdx force:org:open",

    POST_FIX:"__C",
    POST_FIX2:"__E",
    DOUBLE_UNS:"__",

    IMG_PATH1:"Images/openinorg.png",
    IMG_PATH2:"Images/whiteRefresh.png",
    JSON_DATA_PATH: "\\objdata\\dataInfos.json",

    EXTENSION_TO_CMP_MAP: new Map([ 
        ['cmp', 'AuraDefinitionBundle'],
        ['auradoc', 'AuraDefinitionBundle'],
        ['cmp-meta', 'AuraDefinitionBundle'],
        ['design', 'AuraDefinitionBundle'],
        ['js-meta', 'LightningComponentBundle'],
        ['html', 'LightningComponentBundle']
    ]),
    API_TO_LABEL : new Map([
        ['LastModifiedBy.Name','LastModifiedBy'],
        ['CreatedBy.Name','CreatedBy'],
        ['Author.Name','Author'],
        ['EntityDefinition.QualifiedApiName','SobjectType'],
        ['EntityDefinition.DeveloperName', 'SobjectType'],
        ['Profile.Name', 'ProfileName'],
        ['Definition.DeveloperName', 'DeveloperName']
    ]),
    TYPE_TO_EXTENSION: new Map([
        ['Apex Class', 'cls'],
        ['Apex Trigger', 'trigger'],
        ['Aura Component', 'auradefinitionbundle'],
        ['Lightning Web Component', 'lightningcomponentbundle'],
        ['SObject', 'object-meta'],
        ['PermissionSet', 'permissionset-meta'],
        ['Document', 'document-meta'],
        ['Profile', 'profile-meta'],
        ['Quick Action', 'quickaction-meta'],
        ['RecordType', 'recordtype-meta'],
        ['StaticResource', 'resource-meta'],
        ['ValidationRule', 'validationrule-meta'],
        ['Flow', 'flow-meta'],
        ['FlexiPage', 'flexipage-meta'],
        ['GlobalValueSet', 'globalvalueset-meta'],
        ['Layout', 'layout-meta']
    ])
    
});