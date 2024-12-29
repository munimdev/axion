module.exports = {
    createSchool: [
        {
            model: "shortText",
            path: "name",
            required: true,
        },
        {
            model: "address",
            path: "address",
            required: true,
        },
        {
            model: "phone",
            path: "phone",
            required: true,
        },
        {
            model: "email",
            path: "email",
            required: true,
        },
    ],
    updateSchool: [
        {
            model: "shortText",
            path: "name",
        },
        {
            model: "address",
            path: "address",
        },
        {
            model: "phone",
            path: "phone",
        },
        {
            model: "email",
            path: "email",
        },
    ],
    getSchool: [
        {
            model: "id",
            path: "id",
            required: true,
        },
    ],
    deleteSchool: [
        {
            model: "id",
            path: "id",
            required: true,
        },
    ],
}
