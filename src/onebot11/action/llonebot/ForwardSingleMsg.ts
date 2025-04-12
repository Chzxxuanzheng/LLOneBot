import { BaseAction } from '../BaseAction'
import { ActionName } from '../types'
import { createPeer } from '@/onebot11/helper/createMessage'

interface Payload {
  message_id: number | string
  group_id: number | string
  user_id?: number | string
}

interface Response {
  message_id: number
}

abstract class ForwardSingleMsg extends BaseAction<Payload, Response> {
  protected async _handle(payload: Payload) {
    if (!payload.message_id) {
      throw Error('message_id不能为空')
    }
    const msg = await this.ctx.store.getMsgInfoByShortId(+payload.message_id)
    if (!msg) {
      throw new Error(`无法找到消息${payload.message_id}`)
    }
    const peer = await createPeer(this.ctx, payload)
    const ret = await this.ctx.ntMsgApi.forwardMsg(msg.peer, peer, [msg.msgId])
    if (ret.length === 0) {
      throw new Error(`转发消息失败`)
    }
    const msgShortId = this.ctx.store.createMsgShortId({
      chatType: ret[0].chatType,
      peerUid: ret[0].peerUid
    }, ret[0].msgId)
    return { message_id: msgShortId }
  }
}

export class ForwardFriendSingleMsg extends ForwardSingleMsg {
  actionName = ActionName.ForwardFriendSingleMsg
}

export class ForwardGroupSingleMsg extends ForwardSingleMsg {
  actionName = ActionName.ForwardGroupSingleMsg
}
