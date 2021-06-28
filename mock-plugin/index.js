import { send } from 'process'

/**
 * { get: [] }
 */
const routeMap = {}
const path = require('path')

const createRoute = function (mockList) {
    mockList.forEach(mock => {
        const { method = 'get', url, response } = mock
        routeMap[method] = routeMap[method] || []
        routeMap[method].push({
            url,
            method: method.toLowerCase(),
            handler: response
        })
    })
}

// 默认导出函数
export default function (options) {
    options.entry = options.entry || './data.js'
    if (!path.isAbsolute(options.entry)) {
        options.entry = path.resolve(process.cwd(), options.entry)
    }
    return {
        configServer: function ({ app }) {
            const routeConfig = require(options.entry)
            createRoute(routeConfig)
            
            const middleWare = (req, res, next) => {
                let route = matchRoute(req)
                // 走匹配到的路由
                if (route) {
                    // 重新定义send，因为vite使用的http插件，并不存在send方法
                    res.send = send
                    route.handler(req, res)
                } else {
                    next()
                }
            }
            app.use(middleWare)
        }
    }
}