module.exports = [
    {
        url: '/api/users',
        type: 'get',
        response: (req, res) => {
            return res.send([
                { name: 'tony', age: '30' },
                { name: 'alex', age: '28' }
            ])
        }
    }
]