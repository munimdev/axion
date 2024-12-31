const ValidatorsLoader = require("../loaders/ValidatorsLoader")
const utils = require("../libs/utils")
const { actions } = require("../static_arch/main.system")

// Mock users for testing
const mockUsers = {
    superadmin: {
        username: "superadmin",
        email: "super@mail.com",
        password: "12345678",
        role: "superadmin",
        _id: "user:super@mail.com",
        _label: "user",
    },
    schoolAdmin: {
        username: "schooladmin",
        email: "admin@mail.com",
        password: "12345678",
        role: "schoolAdmin",
        _id: "user:admin@mail.com",
        _label: "user",
    },
    teacher: {
        username: "teacher",
        email: "teacher@mail.com",
        password: "12345678",
        role: "user",
        _id: "user:teacher@mail.com",
        _label: "user",
    },
}

// Mock data for testing
const mockData = {
    school: {
        name: "Test School",
        address: "123 Test St",
        phone: "+212345678910",
        email: "school@test.com",
    },
    classroom: {
        capacity: 30,
        grade: "1",
        section: "A",
        academicYear: "2024-2025",
        resources: ["Projector", "Whiteboard"],
    },
    student: {
        name: "John Doe",
        dateOfBirth: "2010-01-01",
        gender: "male",
        parentName: "Jane Doe",
        parentPhone: "+212345678911",
        email: "john@test.com",
        enrollmentDate: "2024-01-01",
        bloodGroup: "A+",
        emergencyContact: "+212345678912",
        medicalConditions: ["None"],
    },
}

// Setup validators
const setupValidators = () => {
    const validatorsLoader = new ValidatorsLoader({
        models: require("../managers/_common/schema.models"),
        customValidators: require("../managers/_common/schema.validators"),
    })
    return validatorsLoader.load()
}

// Mock managers
const mockManagers = {
    shark: {
        isGranted: ({ role, action, layer }) => {
            // Superadmin can do anything
            if (role === "superadmin") {
                return true
            }

            // School admin base permissions
            if (role === "schoolAdmin") {
                // Note: Actual school-specific access is handled by _validatePermission
                if (layer === "board.school" && ["read", "update"].includes(action)) {
                    return true
                }
                if (
                    actions[action] <= actions["update"] &&
                    ["board.school.class", "board.school.class.student"].includes(layer)
                ) {
                    return true
                }
            }

            return false
        },
        addDirectAccess: () => Promise.resolve(true),
    },
    responseDispatcher: {
        dispatch: () => {},
    },
    token: {
        genLongToken: () => "mock_token",
    },
}

// Setup test environment
const setupTestEnvironment = async () => {
    const validators = setupValidators()

    return {
        oyster: global.oyster,
        validators,
        utils,
        managers: mockManagers,
    }
}

module.exports = {
    mockUsers,
    mockData,
    setupTestEnvironment,
    mockManagers,
}
