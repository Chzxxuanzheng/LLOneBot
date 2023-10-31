declare enum AtType {
    notAt = 0,
    atUser = 2
}

declare type Peer = {
    chatType: "private" | "group"
    name: string
    uid: string  // qq号
}

interface MessageElement {
    raw: {
        elements: {

            replyElement: {
                senderUid: string,  // 原消息发送者QQ号
                sourceMsgIsIncPic: boolean;  // 原消息是否有图片
                sourceMsgText: string;
                sourceMsgIdInRecords: string;  // 原消息id
            },
            textElement: {
                atType: AtType
                atUid: string,
                content: string
            },
            picElement: {
                sourcePath: string // 图片本地路径
                picWidth: number
                picHeight: number
                fileSize: number
                fileName: string
                fileUuid: string
            }
        }[]
    }

    peer: Peer,
    sender: {
        uid: string  // 一串加密的字符串
        memberName: string
        nickname: string
    }
}

declare type User = {
    avatarUrl?: string;
    bio?: string;  // 签名
    nickName: string;
    uid?: string;  // 加密的字符串
    uin: string; // QQ号
}

declare type Group = {
    uid: string; // 群号
    name: string;
}

declare type SendMessage = {
    type: "text",
    content: string,
} | {
    type: "image",
    file: string, // 这是本地路径？
}

declare var LLAPI: {
    on(event: "new-messages", callback: (data: MessageElement[]) => void): void;
    getAccountInfo(): Promise<{
        uid: string  // qq
        uin: string  // 一串加密的字符串
    }>

    // uid是一串加密的字符串, 收到群消息的时候，可以用此函数获取群成员的qq号
    getUserInfo(uid: string): Promise<User>;
    sendMessage(peer: Peer, message: SendMessage[]): Promise<void>;
    getGroupsList(forced: boolean): Promise<Group[]>
    getFriendsList(forced: boolean): Promise<User[]>
};

declare type PostDataSendMsg = {
    action: "send_private_msg" | "send_group_msg" | "get_group_list",
    params: {
        user_id: string,
        group_id: string,
        message: SendMessage[];
    }
}

declare var llonebot: {
    postData: (data: any) => void
    listenSendMessage: (handle: (msg: PostDataSendMsg) => void) => void
    updateGroups: (groups: Group[]) => void
    updateFriends: (friends: User[]) => void
    updateGroupMembers: (data: { groupMembers: User[], group_id: string }) => void
    startExpress: () => void
};