import { BaseAction, Schema } from '../BaseAction'
import { OB11Message } from '../../types'
import { ActionName } from '../types'
import { ChatType, Peer } from '@/ntqqapi/types'
import { OB11Entities } from '../../entities'
import { RawMessage } from '@/ntqqapi/types'
import { filterNullable, parseBool } from '@/common/utils/misc'
import { ParseMessageConfig } from '@/onebot11/types'

interface Payload {
  group_id: number | string
  message_seq?: number | string
  count: number | string
  reverseOrder: boolean
}

interface Response {
  messages: OB11Message[]
}

export class GetGroupMsgHistory extends BaseAction<Payload, Response> {
  actionName = ActionName.GoCQHTTP_GetGroupMsgHistory
  payloadSchema = Schema.object({
    group_id: Schema.union([Number, String]).required(),
    message_seq: Schema.union([Number, String]),
    count: Schema.union([Number, String]).default(20),
    reverseOrder: Schema.union([Boolean, Schema.transform(String, parseBool)]).default(false)
  })

  private async getMessage(config: ParseMessageConfig, peer: Peer, count: number, seq?: number | string) {
    let msgList: RawMessage[]
    if (!seq || +seq === 0) {
      msgList = (await this.ctx.ntMsgApi.getAioFirstViewLatestMsgs(peer, count)).msgList
    } else {
      msgList = (await this.ctx.ntMsgApi.getMsgsBySeqAndCount(peer, String(seq), count, true, true)).msgList
    }
    if (!msgList?.length) return
    const ob11MsgList = await Promise.all(msgList.map(msg => {
      let rawMsg = msg
      if (rawMsg.recallTime !== '0') {
        let msg = this.ctx.store.getMsgCache(rawMsg.msgId)
        if (msg) {
          rawMsg = msg
        }
      }
      return OB11Entities.message(this.ctx, rawMsg, undefined, undefined, config)
    }))
    return { list: filterNullable(ob11MsgList), seq: +msgList[0].msgSeq }
  }

  protected async _handle(payload: Payload, config: ParseMessageConfig): Promise<Response> {
    const peer: Peer = {
      chatType: ChatType.Group,
      peerUid: payload.group_id.toString(),
      guildId: ''
    }

    const messages: OB11Message[] = []
    let seq = payload.message_seq
    let count = +payload.count

    while (count > 0) {
      const res = await this.getMessage(config, peer, count, seq)
      if (!res) break
      seq = res.seq - 1
      count -= res.list.length
      messages.unshift(...res.list)
    }

    if (payload.reverseOrder) messages.reverse()
    return { messages }
  }
}
