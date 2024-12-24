import { BaseAction, Schema } from '../BaseAction'
import { ActionName } from '../types'
import { selfInfo } from '@/common/globalVars'
import { Dict } from 'cosmokit'

interface Payload {
  start: number | string,
  count: number | string
}

interface Response {
  users: Dict[]
  nextStart: number
}

export class GetProfileLikeMe extends BaseAction<Payload, Response> {
  actionName = ActionName.GetProfileLikeMe
  payloadSchema = Schema.object({
    start: Schema.union([Number, String]).default(-1), // 从0开始，-1表示获取全部
    count: Schema.union([Number, String]).default(20) // 最多30一页
  })

  async _handle(payload: Payload): Promise<Response> {

    const ret = await this.ctx.ntUserApi.getProfileLikeMe(selfInfo.uid, +payload.start, +payload.count)
    const {voteInfo} = ret.info.userLikeInfos[0]
    const users = voteInfo.userInfos
    for (const item of users) {
      try {
        item.uin = Number(await this.ctx.ntUserApi.getUinByUid(item.uid)) || 0
      }catch (e) {
        item.uin = 0
      }
    }
    return {users: users, nextStart: ret.info.start}
  }
}
