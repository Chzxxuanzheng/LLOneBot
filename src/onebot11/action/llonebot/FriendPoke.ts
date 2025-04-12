import { BaseAction, Schema } from '../BaseAction'
import { ActionName } from '../types'

interface Payload {
  user_id: number | string
}

export class FriendPoke extends BaseAction<Payload, null> {
  actionName = ActionName.FriendPoke
  payloadSchema = Schema.object({
    user_id: Schema.union([Number, String]).required()
  })

  async _handle(payload: Payload) {
    if (this.ctx.app.pmhq.activated) {
      await this.ctx.app.pmhq.sendFriendPoke(+payload.user_id)
      return null
    }
    if (!this.ctx.app.crychic.checkPlatform() || !this.ctx.app.crychic.checkVersion()) {
      // await this.ctx.app.packet.sendPokePacket(+payload.user_id)
      throw new Error('戳一戳暂时只支持Windows QQ 27333 ~ 27597版本')
    }
    else {
      await this.ctx.app.crychic.sendFriendPoke(+payload.user_id)
    }
    return null
  }
}
