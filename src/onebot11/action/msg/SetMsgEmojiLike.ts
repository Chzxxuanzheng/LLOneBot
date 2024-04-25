import {ActionName} from "../types";
import BaseAction from "../BaseAction";
import {dbUtil} from "../../../common/db";
import {NTQQMsgApi} from "../../../ntqqapi/api/msg";

interface Payload {
    message_id: number,
    emoji_id: string
}

export class SetMsgEmojiLike extends BaseAction<Payload, any> {
    actionName = ActionName.SetMsgEmojiLike

    protected async _handle(payload: Payload) {
        let msg = await dbUtil.getMsgByShortId(payload.message_id)
        if (!msg) {
            throw new Error('msg not found')
        }
        if (!payload.emoji_id){
            throw new Error('emojiId not found')
        }
        return await NTQQMsgApi.setEmojiLike({
            chatType: msg.chatType,
            peerUid: msg.peerUid
        }, msg.msgSeq, payload.emoji_id, true)
    }
}
