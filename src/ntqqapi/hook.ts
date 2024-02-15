import {BrowserWindow} from 'electron';
import {log} from "../common/utils";
import {NTQQApi, NTQQApiClass, sendMessagePool} from "./ntcall";
import {Group, GroupMember, RawMessage, User} from "./types";
import {addHistoryMsg, friends, groups, msgHistory} from "../common/data";
import {v4 as uuidv4} from 'uuid';
import {callEvent, EventType} from "../onebot11/event";
import {OB11Message} from "../onebot11/types";
import {OB11Constructor} from "../onebot11/constructor";

export let hookApiCallbacks: Record<string, (apiReturn: any) => void> = {}

export enum ReceiveCmd {
    UPDATE_MSG = "nodeIKernelMsgListener/onMsgInfoListUpdate",
    NEW_MSG = "nodeIKernelMsgListener/onRecvMsg",
    SELF_SEND_MSG = "nodeIKernelMsgListener/onAddSendMsg",
    USER_INFO = "nodeIKernelProfileListener/onProfileSimpleChanged",
    GROUPS = "nodeIKernelGroupListener/onGroupListUpdate",
    GROUPS_UNIX = "onGroupListUpdate",
    FRIENDS = "onBuddyListChange"
}

interface NTQQApiReturnData<PayloadType = unknown> extends Array<any> {
    0: {
        "type": "request",
        "eventName": NTQQApiClass,
        "callbackId"?: string
    },
    1:
        {
            cmdName: ReceiveCmd,
            cmdType: "event",
            payload: PayloadType
        }[]
}

let receiveHooks: Array<{
    method: ReceiveCmd,
    hookFunc: (payload: any) => void,
    id: string
}> = []

export function hookNTQQApiReceive(window: BrowserWindow) {
    const originalSend = window.webContents.send;
    const patchSend = (channel: string, ...args: NTQQApiReturnData) => {
        // console.log(`received ntqq api message: ${channel}`, JSON.stringify(args))
        if (args?.[1] instanceof Array) {
            for (let receiveData of args?.[1]) {
                const ntQQApiMethodName = receiveData.cmdName;
                // log(`received ntqq api message: ${channel} ${ntQQApiMethodName}`, JSON.stringify(receiveData))
                for (let hook of receiveHooks) {
                    if (hook.method === ntQQApiMethodName) {
                        new Promise((resolve, reject) => {
                            try {
                                hook.hookFunc(receiveData.payload);
                            } catch (e) {
                                log("hook error", e, receiveData.payload)
                            }
                        }).then()
                    }
                }
            }
        }
        if (args[0]?.callbackId) {
            // log("hookApiCallback", hookApiCallbacks, args)
            const callbackId = args[0].callbackId;
            if (hookApiCallbacks[callbackId]) {
                // log("callback found")
                new Promise((resolve, reject) => {
                    hookApiCallbacks[callbackId](args[1]);
                }).then()
                delete hookApiCallbacks[callbackId];
            }
        }
        return originalSend.call(window.webContents, channel, ...args);
    }
    window.webContents.send = patchSend;
}

export function registerReceiveHook<PayloadType>(method: ReceiveCmd, hookFunc: (payload: PayloadType) => void): string {
    const id = uuidv4()
    receiveHooks.push({
        method,
        hookFunc,
        id
    })
    return id;
}

export function removeReceiveHook(id: string) {
    const index = receiveHooks.findIndex(h => h.id === id)
    receiveHooks.splice(index, 1);
}

async function updateGroups(_groups: Group[], needUpdate: boolean = true) {
    for (let group of _groups) {
        let existGroup = groups.find(g => g.groupCode == group.groupCode);
        if (existGroup) {
            Object.assign(existGroup, group);
        }
        else {
            groups.push(group);
            existGroup = group;
        }

        if (needUpdate) {
            const members = await NTQQApi.getGroupMembers(group.groupCode);

            if (members) {
                existGroup.members = members;
            }
        }
    }
}

async function processGroupEvent(payload) {
    try {
        const newGroupList = payload.groupList;
        for (const group of newGroupList) {
            let existGroup = groups.find(g => g.groupCode == group.groupCode);
            if (existGroup) {
                if (existGroup.memberCount > group.memberCount) {
                    console.log("群人数减少力!");
                    const oldMembers = existGroup.members;
                    console.log("旧群人员：");
                    for (const member of oldMembers) {
                        console.log(member.nick);
                    }

                    const newMembers = await NTQQApi.getGroupMembers(group.groupCode);
                    console.log("新群人员：");
                    for (const member of newMembers) {
                        console.log(member.nick);
                    }

                    group.members = newMembers;
                    const newMembersSet = new Set<string>();  // 建立索引降低时间复杂度

                    for (const member of newMembers) {
                        newMembersSet.add(member.uin);
                    }

                    for (const member of oldMembers) {
                        if (!newMembersSet.has(member.uin)) {
                            console.log("减少的群员是:" + member.uin);
                            break;
                        }
                    }

                }
                else if (existGroup.memberCount < group.memberCount) {
                    console.log("群人数增加力!");
                    console.log("旧群人员：");
                    for (const member of existGroup.members) {
                        console.log(member.nick);
                    }

                    const oldMembersSet = new Set<string>();
                    for (const member of existGroup.members) {
                        oldMembersSet.add(member.uin);
                    }

                    const newMembers = await NTQQApi.getGroupMembers(group.groupCode);

                    console.log("新群人员：");
                    for (const member of newMembers) {
                        console.log(member.nick);
                    }

                    group.members = newMembers;
                    for (const member of newMembers) {
                        if (!oldMembersSet.has(member.uin)) {
                            console.log("增加的群员是:" + member.uin);
                            break;
                        }
                    }
                }
            }
        }

        updateGroups(newGroupList, false).then();
    }
    catch (e) {
        updateGroups(payload.groupList).then();
        console.log(e);
    }
}

registerReceiveHook<{ groupList: Group[], updateType: number }>(ReceiveCmd.GROUPS, (payload) => {
    if (payload.updateType != 2) {
        updateGroups(payload.groupList).then();
    }
    else {
        if (process.platform == "win32") {
            processGroupEvent(payload).then();
        }
    }
})
registerReceiveHook<{ groupList: Group[], updateType: number }>(ReceiveCmd.GROUPS_UNIX, (payload) => {
    if (payload.updateType != 2) {
        updateGroups(payload.groupList).then();
    }
    else {
        if (process.platform != "win32") {
            processGroupEvent(payload).then();
        }
    }
})
registerReceiveHook<{
    data: { categoryId: number, categroyName: string, categroyMbCount: number, buddyList: User[] }[]
}>(ReceiveCmd.FRIENDS, payload => {
    for (const fData of payload.data) {
        const _friends = fData.buddyList;
        for (let friend of _friends) {
            let existFriend = friends.find(f => f.uin == friend.uin)
            if (!existFriend) {
                friends.push(friend)
            } else {
                Object.assign(existFriend, friend)
            }
        }
    }
})

registerReceiveHook<{ msgList: Array<RawMessage> }>(ReceiveCmd.UPDATE_MSG, (payload) => {
    for (const message of payload.msgList) {
        addHistoryMsg(message)
    }
})

registerReceiveHook<{ msgList: Array<RawMessage> }>(ReceiveCmd.NEW_MSG, (payload) => {
    for (const message of payload.msgList) {
        // log("收到新消息，push到历史记录", message)
        OB11Constructor.message(message).then(
            function (message) {
                callEvent<OB11Message>(EventType.MESSAGE, message);
            }
        );

        addHistoryMsg(message)
    }
    const msgIds = Object.keys(msgHistory);
    if (msgIds.length > 30000) {
        delete msgHistory[msgIds.sort()[0]]
    }
})

registerReceiveHook<{ msgRecord: RawMessage }>(ReceiveCmd.SELF_SEND_MSG, ({msgRecord}) => {
    const message = msgRecord;
    const peerUid = message.peerUid;
    // log("收到自己发送成功的消息", Object.keys(sendMessagePool), message);
    const sendCallback = sendMessagePool[peerUid];
    if (sendCallback) {
        try {
            sendCallback(message);
        } catch (e) {
            log("receive self msg error", e.stack)
        }
    }
})
