import BaseAction from "./BaseAction";
import {OB11Status} from "../types";
import {ActionName} from "./types";


export default class GetStatus extends BaseAction<any, OB11Status> {
    actionName = ActionName.GetStatus
    protected async _handle(payload: any): Promise<OB11Status> {
        return {
            online: null,
            good: true
        }
    }
}