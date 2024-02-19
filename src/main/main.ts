// 运行在 Electron 主进程 下的插件入口

import {BrowserWindow, ipcMain} from 'electron';

import {Config} from "../common/types";
import {postMsg, initWebsocket} from "../onebot11/server";
import {CHANNEL_GET_CONFIG, CHANNEL_LOG, CHANNEL_SET_CONFIG,} from "../common/channels";
import {CONFIG_DIR, getConfigUtil, log} from "../common/utils";
import {addHistoryMsg, getGroupMember, msgHistory, selfInfo} from "../common/data";
import {hookNTQQApiReceive, ReceiveCmd, registerReceiveHook} from "../ntqqapi/hook";
import {OB11Constructor} from "../onebot11/constructor";
import {NTQQApi} from "../ntqqapi/ntcall";
import {ChatType, RawMessage} from "../ntqqapi/types";
import {OB11FriendRecallNoticeEvent} from "../onebot11/event/notice/OB11FriendRecallNoticeEvent";
import {OB11GroupRecallNoticeEvent} from "../onebot11/event/notice/OB11GroupRecallNoticeEvent";
import {ob11HTTPServer} from "../onebot11/server/http";

const fs = require('fs');

let running = false;


// 加载插件时触发
function onLoad() {
    log("llonebot main onLoad");

    // const config_dir = browserWindow.LiteLoader.plugins["LLOneBot"].path.data;

    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, {recursive: true});
    }
    ipcMain.handle(CHANNEL_GET_CONFIG, (event: any, arg: any) => {
        try {
            return getConfigUtil().getConfig();
        }catch (e) {
            console.log("获取配置文件出错", e)
        }
    })
    ipcMain.on(CHANNEL_SET_CONFIG, (event: any, arg: Config) => {
        let oldConfig = getConfigUtil().getConfig();
        getConfigUtil().setConfig(arg)
        if (arg.ob11.httpPort != oldConfig.ob11.httpPort && arg.ob11.enableHttp) {
            ob11HTTPServer.restart(arg.ob11.httpPort);
        }
        if (!arg.ob11.enableHttp){
            ob11HTTPServer.stop()
        }
        else{
            ob11HTTPServer.start(arg.ob11.httpPort);
        }
        if (arg.ob11.wsPort != oldConfig.ob11.wsPort) {
            initWebsocket(arg.ob11.wsPort)
        }
    })

    ipcMain.on(CHANNEL_LOG, (event: any, arg: any) => {
        log(arg);
    })


    function postRawMsg(msgList: RawMessage[]) {
        const {debug, reportSelfMessage} = getConfigUtil().getConfig();
        for (let message of msgList) {
            log("收到新消息", message)
            message.msgShortId = msgHistory[message.msgId]?.msgShortId
            if (!message.msgShortId) {
                addHistoryMsg(message);
            }
            OB11Constructor.message(message).then((msg) => {
                if (debug) {
                    msg.raw = message;
                }
                if (msg.user_id.toString() == selfInfo.uin && !reportSelfMessage) {
                    return
                }
                postMsg(msg);
            }).catch(e => log("constructMessage error: ", e.toString()));
        }
    }


    async function start() {
        registerReceiveHook<{ msgList: Array<RawMessage> }>(ReceiveCmd.NEW_MSG, (payload) => {
            try {
                postRawMsg(payload.msgList);
            } catch (e) {
                log("report message error: ", e.toString());
            }
        })
        registerReceiveHook<{ msgList: Array<RawMessage> }>(ReceiveCmd.UPDATE_MSG, async (payload) => {
            for (const message of payload.msgList) {
                // log("message update", message, message.sendStatus)
                if (message.sendStatus === 2) {
                    // 撤回消息上报
                    const oriMessage = msgHistory[message.msgId]
                    if (!oriMessage) {
                        continue
                    }
                    if (message.chatType == ChatType.friend) {
                        const friendRecallEvent = new OB11FriendRecallNoticeEvent(parseInt(message.senderUin), oriMessage.msgShortId);
                        postMsg(friendRecallEvent);
                    } else if (message.chatType == ChatType.group) {
                        let operatorId = message.senderUin
                        for (const element of message.elements) {
                            const operatorUid = element.grayTipElement?.revokeElement.operatorUid
                            const operator = await getGroupMember(message.peerUin, null, operatorUid)
                            operatorId = operator.uin
                        }
                        const groupRecallEvent = new OB11GroupRecallNoticeEvent(
                            parseInt(message.peerUin),
                            parseInt(message.senderUin),
                            parseInt(operatorId),
                            oriMessage.msgShortId
                        )

                        postMsg(groupRecallEvent);
                    }
                    continue
                }
                addHistoryMsg(message)
            }
        })
        registerReceiveHook<{ msgRecord: RawMessage }>(ReceiveCmd.SELF_SEND_MSG, (payload) => {
            const {reportSelfMessage} = getConfigUtil().getConfig();
            if (!reportSelfMessage) {
                return
            }
            // log("reportSelfMessage", payload)
            try {
                postRawMsg([payload.msgRecord]);
            } catch (e) {
                log("report self message error: ", e.toString());
            }
        })
        NTQQApi.getGroups(true).then()
        const config = getConfigUtil().getConfig()
        try {
            ob11HTTPServer.start(config.ob11.httpPort)
            initWebsocket(config.ob11.wsPort);
        }catch (e) {
            console.log("start failed", e)
        }
        log("LLOneBot start")
    }

    const init = async () => {
        try {
            const _ = await NTQQApi.getSelfInfo();
            Object.assign(selfInfo, _);
            selfInfo.nick = selfInfo.uin;
            log("get self simple info", _);
        } catch (e) {
            log("retry get self info");
        }
        if (selfInfo.uin) {
            try {
                const userInfo = (await NTQQApi.getUserInfo(selfInfo.uid));
                log("self info", userInfo);
                if (userInfo) {
                    selfInfo.nick = userInfo.nick;
                } else {
                    return setTimeout(init, 1000);
                }
            } catch (e) {
                log("get self nickname failed", e.toString());
                return setTimeout(init, 1000);
            }
            start().then();
        } else {
            setTimeout(init, 1000)
        }
    }
    setTimeout(init, 1000);
}


// 创建窗口时触发
function onBrowserWindowCreated(window: BrowserWindow) {
    try {
        hookNTQQApiReceive(window);
    } catch (e) {
        log("LLOneBot hook error: ", e.toString())
    }
}

try {
    onLoad();
} catch (e: any) {
    console.log(e.toString())
}

// 这两个函数都是可选的
export {
    onBrowserWindowCreated
}