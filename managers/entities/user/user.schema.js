module.exports = {
    createUser: [
        {
            model: "username",
            path: "username",
            required: true,
        },
        {
            model: "email",
            path: "email",
            required: true,
        },
        {
            model: "password",
            path: "password",
            required: true,
        },
        {
            model: "role",
            path: "role",
            default: "user",
        },
    ],
    updateUser: [
        {
            model: "username",
            path: "username",
        },
        {
            model: "email",
            path: "email",
        },
        {
            model: "role",
            path: "role",
        },
    ],
    getUser: [
        {
            model: "id",
            path: "id",
            required: true,
        },
    ],
    deleteUser: [
        {
            model: "id",
            path: "id",
            required: true,
        },
    ],
    loginUser: [
        {
            model: "email",
            path: "email",
            required: true,
        },
        {
            model: "password",
            path: "password",
            required: true,
        },
    ],
}
