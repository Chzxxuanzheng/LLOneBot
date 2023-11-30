import {Config} from "../common/types";

const fs = require("fs")

export class ConfigUtil{
    configPath: string;

    constructor(configPath: string) {
        this.configPath = configPath;
    }

    getConfig(): Config{
        if (!fs.existsSync(this.configPath)) {
            return {port:3000, hosts: ["http://192.168.1.2:5000/"]}
        } else {
            const data = fs.readFileSync(this.configPath, "utf-8");
            let jsonData =JSON.parse(data);
            if (!jsonData.hosts){
                jsonData.hosts = []
            }
            return jsonData;
        }
    }
}
