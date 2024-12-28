module.exports = {
    createSchool: [
        {
            model: "text",
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
            model: "schoolName",
            path: "name",
        },
        {
            model: "address",
            path: "address",
        },
        {
            model: "contactNumber",
            path: "contactNumber",
        },
        {
            model: "capacity",
            path: "capacity",
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
