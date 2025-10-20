import { BaseAction, Schema } from '../../BaseAction'
import { ActionName } from '../../types'

interface Payload {
  group_id: number | string
  user_id: number | string
}

export class GroupPoke extends BaseAction<Payload, null> {
  actionName = ActionName.GroupPoke
  payloadSchema = Schema.object({
    group_id: Schema.union([Number, String]).required(),
    user_id: Schema.union([Number, String]).required()
  })

  async _handle(payload: Payload) {
    try{
      await this.ctx.app.pmhq.sendGroupPoke(+payload.group_id, +payload.user_id)
      return null
    }catch (e) {
      this.ctx.logger.error('pmhq 发包失败', e)
    }
    return null
  }
}
