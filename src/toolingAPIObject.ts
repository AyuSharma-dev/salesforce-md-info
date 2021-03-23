export module toolingAPIObject {

    export interface Attributes {
        type: string;
        url: string;
    }

    export interface Attributes2 {
        type: string;
        url: string;
    }

    export interface CreatedBy {
        attributes: Attributes2;
        Name: string;
    }

    export interface Attributes3 {
        type: string;
        url: string;
    }

    export interface LastModifiedBy {
        attributes: Attributes3;
        Name: string;
    }

    export interface Record {
        attributes: Attributes;
        Id: string;
        DeveloperName: string;
        MasterLabel: string;
        ApiVersion: number;
        Description?: any;
        CreatedDate: Date;
        CreatedBy: CreatedBy;
        LastModifiedDate: Date;
        LastModifiedBy: LastModifiedBy;
    }

    export interface Result {
        size: number;
        totalSize: number;
        done: boolean;
        queryLocator?: any;
        entityTypeName: string;
        records: Record[];
        instanceUrl: string;
    }

    export interface RootObject {
        status: number;
        result: Result;
        message: string;
    }

}

