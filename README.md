# School Management System API

A RESTful API service for managing schools, classrooms, and students with role-based access control.

## Features

- Role-based access control (RBAC)
- School management
- Classroom management with resource tracking
- Student management with profile information
- Secure authentication using JWT
- User management with different roles
- Token-based authentication with long and short tokens

## System Architecture

### Technology Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: Redis
- **Authentication**: JWT (two-tier token system)
- **Input Validation**: Custom validators
- **Rate Limiting**: Built-in rate limiter middleware
- **API Documentation**: Postman Collection

### Key Components

- **Managers**: Business logic implementation for each entity
- **Validators**: Input validation and sanitization
- **Middleware**: Authentication, rate limiting, and error handling
- **Schema**: Data models and validation rules

## Setup Instructions

### Prerequisites

- Node.js (v20 or higher)
- Redis (redis-stack)
- Docker and Docker Compose (optional)

### Local Development Setup

1. Clone the repository:

```bash
git clone <repository-url>
cd school-management-api
```

2. Install dependencies:

```bash
npm install
```

3. Create `.env` file in the root directory:

```env
SERVICE_NAME=school_management
NODE_ENV=development
USER_PORT=5111
REDIS_URI=redis://localhost:6379
LONG_TOKEN_SECRET=your_long_token_secret
SHORT_TOKEN_SECRET=your_short_token_secret
NACL_SECRET=your_nacl_secret
OYSTER_REDIS=redis://localhost:6379
OYSTER_PREFIX=school_
```

4. Start Redis (if not using Docker):

    - Install and start Redis-Stack server

5. Run the application:

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

### Docker Setup

1. Build and run using Docker Compose:

```bash
docker-compose up -d
```

This will:

- Build the Node.js application
- Start Redis-Stack container
- Set up the network and volumes
- Expose the API on port 5111

## Database Schema

### Redis Data Structure

The system uses Redis for data persistence with the following key patterns:

1. **Users**

```
user:<email> {
    _id: string
    _label: "user"
    email: string
    username: string
    password: string (hashed)
    role: "superadmin" | "schoolAdmin" | "user"
    createdAt: number
    updatedAt?: number
}
```

2. **Schools**

```
school:<id> {
    _id: string
    _label: "school"
    name: string
    address: string
    phone: string
    email: string
    createdAt: number
    createdBy: string
    updatedAt?: number
    updatedBy?: string
    _admins: string[]
}
```

3. **Classrooms**

```
classroom:<id> {
    _id: string
    _label: "classroom"
    capacity: number
    grade: string
    section: string
    academicYear: string
    resources: string[]
    schoolId: string
    createdAt: number
    createdBy: string
    updatedAt?: number
    updatedBy?: string
}
```

4. **Students**

```
student:<id> {
    _id: string
    _label: "student"
    name: string
    dateOfBirth: string
    gender: string
    parentName: string
    parentPhone: string
    email: string
    enrollmentDate: string
    bloodGroup: string
    emergencyContact: {
        name: string
        relation: string
        phone: string
    }
    medicalConditions: string[]
    classroomId: string
    schoolId: string
    createdAt: number
    createdBy: string
    updatedAt?: number
    updatedBy?: string
}
```

### Relations

The system uses Redis relations to maintain relationships between entities:

1. School-Classroom Relation:

    - `school:<id>/_members` → `[classroom:<id>~1]`

2. School-Student Relation:

    - `school:<id>/_members` → `[student:<id>~1]`

3. Classroom-Student Relation:

    - `classroom:<id>/_members` → `[student:<id>~1]`

4. School-Admin Relation:
    - `school:<id>/_members` → `[user:<id>~1]`

## Testing

The project includes comprehensive test coverage for all major components:

### Test Structure

```
tests/
├── setup.js                    # Test environment setup
├── helpers.js                  # Test helper functions
└── school-management-system.test.js  # Main test suite
```

### Test Categories

1. **Unit Tests**

    - Validator functions
    - Helper utilities
    - Data transformations

2. **Integration Tests**

    - API endpoints
    - Database operations
    - Authentication flow

3. **Authorization Tests**
    - Role-based access
    - Permission checks
    - Token validation

### Test Coverage

The test suite covers:

- All API endpoints (100% coverage)
- Error scenarios and edge cases
- Input validation
- Authentication and authorization
- Data persistence
- Relations between entities

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests in Docker with clean environment
npm run docker:test:clean
```

### Test Environment

Tests run in an isolated environment with:

- Clean Redis instance
- Mock authentication
- Test-specific configuration
- Automated cleanup

## Security Measures

1. **Authentication**:

    - Two-tier JWT system (long and short tokens)
    - Password hashing using bcrypt
    - Token expiration and rotation

2. **Authorization**:

    - Role-based access control (RBAC)
    - Resource-level permissions
    - School-specific access control

3. **Rate Limiting**:

    - IP-based rate limiting
    - Configurable limits per endpoint
    - Redis-backed rate limit tracking

4. **Input Validation**:
    - Schema-based validation
    - Data sanitization
    - Type checking

## Performance Considerations

1. **Caching**:

    - Redis for data storage and caching
    - Efficient relation-based queries
    - Optimized data structures

2. **Scalability**:

    - Stateless API design
    - Docker containerization
    - Horizontal scaling support

3. **Monitoring**:
    - Error logging and tracking
    - Performance metrics
    - Request/response timing

## API Documentation

### Authentication & Users

| Endpoint                         | Method | Description                                 | Access          |
| -------------------------------- | ------ | ------------------------------------------- | --------------- |
| `/api/user/createUser`           | POST   | Creates a new user                          | Public          |
| `/api/user/loginUser`            | POST   | Authenticates user and returns tokens       | Public          |
| `/api/user/updateUser`           | PATCH  | Updates user information                    | User/Superadmin |
| `/api/user/deleteUser`           | DELETE | Deletes a user                              | Superadmin      |
| `/api/user/getUser`              | GET    | Retrieves user details                      | User/Superadmin |
| `/api/token/v1_createShortToken` | POST   | Creates a short-lived token from long token | Authenticated   |

### Schools

| Endpoint                        | Method | Description                  | Access                   |
| ------------------------------- | ------ | ---------------------------- | ------------------------ |
| `/api/school/createSchool`      | POST   | Creates a new school         | Superadmin               |
| `/api/school/updateSchool`      | PATCH  | Updates school information   | Superadmin, School Admin |
| `/api/school/getSchool`         | GET    | Retrieves school details     | Superadmin, School Admin |
| `/api/school/deleteSchool`      | DELETE | Deletes a school             | Superadmin               |
| `/api/school/assignSchoolAdmin` | POST   | Assigns an admin to a school | Superadmin               |

### Classrooms

| Endpoint                         | Method | Description                       | Access       |
| -------------------------------- | ------ | --------------------------------- | ------------ |
| `/api/classroom/createClassroom` | POST   | Creates a new classroom           | School Admin |
| `/api/classroom/updateClassroom` | PATCH  | Updates classroom information     | School Admin |
| `/api/classroom/getClassroom`    | GET    | Retrieves classroom details       | School Admin |
| `/api/classroom/deleteClassroom` | DELETE | Deletes a classroom               | School Admin |
| `/api/classroom/addResource`     | POST   | Adds a resource to classroom      | School Admin |
| `/api/classroom/removeResource`  | DELETE | Removes a resource from classroom | School Admin |
| `/api/classroom/addStudent`      | POST   | Adds a student to classroom       | School Admin |
| `/api/classroom/removeStudent`   | DELETE | Removes a student from classroom  | School Admin |

### Students

| Endpoint                             | Method | Description                            | Access       |
| ------------------------------------ | ------ | -------------------------------------- | ------------ |
| `/api/student/createStudent`         | POST   | Creates a new student                  | School Admin |
| `/api/student/updateStudent`         | PATCH  | Updates student information            | School Admin |
| `/api/student/getStudent`            | GET    | Retrieves student details              | School Admin |
| `/api/student/deleteStudent`         | DELETE | Deletes a student                      | School Admin |
| `/api/student/transferStudent`       | POST   | Transfers student to another classroom | School Admin |
| `/api/student/listClassroomStudents` | GET    | Lists all students in a classroom      | School Admin |
| `/api/student/listSchoolStudents`    | GET    | Lists all students in a school         | School Admin |

## Request/Response Examples

### Authentication & Users

#### Create User

```http
POST /api/user/createUser
Content-Type: application/json

{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "securepassword123",
  "role": "schoolAdmin"  // Available roles: superadmin, schoolAdmin, user
}

Response:
{
  "user": {
    "username": "johndoe",
    "email": "john@example.com",
    "role": "schoolAdmin",
    "createdAt": 1699123456789
  },
  "longToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### Login User

```http
POST /api/user/loginUser
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "securepassword123"
}

Response:
{
  "user": {
    "username": "johndoe",
    "email": "john@example.com",
    "role": "schoolAdmin"
  },
  "longToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### Create Short Token

```http
POST /api/token/v1_createShortToken
Authorization: Bearer <long_token>

Response:
{
  "shortToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Schools

#### Create School

```http
POST /api/school/createSchool
Content-Type: application/json

{
  "name": "Example School",
  "address": "123 Education St",
  "phone": "+1234567890",
  "email": "contact@example-school.com"
}
```

#### Update School

```http
PATCH /api/school/updateSchool
Content-Type: application/json

{
  "id": "school_id",
  "name": "Updated School Name",
  "address": "456 Learning Ave",
  "phone": "+1987654321",
  "email": "new@example-school.com"
}
```

### Classrooms

#### Create Classroom

```http
POST /api/classroom/createClassroom
Content-Type: application/json

{
  "capacity": 30,
  "grade": "Grade 5",
  "section": "A",
  "academicYear": "2023-2024",
  "resources": ["Whiteboard", "Projector"],
  "schoolId": "school_id"
}
```

#### Add Student to Classroom

```http
POST /api/classroom/addStudent
Content-Type: application/json

{
  "id": "classroom_id",
  "studentId": "student_id"
}
```

### Students

#### Create Student

```http
POST /api/student/createStudent
Content-Type: application/json

{
  "name": "John Doe",
  "dateOfBirth": "2010-01-01",
  "gender": "Male",
  "parentName": "Jane Doe",
  "parentPhone": "+1234567890",
  "email": "john@example.com",
  "enrollmentDate": "2023-09-01",
  "bloodGroup": "A+",
  "emergencyContact": {
    "name": "Jane Doe",
    "relation": "Mother",
    "phone": "+1234567890"
  },
  "medicalConditions": ["Asthma"],
  "classroomId": "classroom_id",
  "schoolId": "school_id"
}
```

## Error Codes

| Code | Description                          |
| ---- | ------------------------------------ |
| 200  | Success                              |
| 400  | Bad Request - Invalid input          |
| 401  | Unauthorized - Invalid token         |
| 403  | Forbidden - Insufficient permissions |
| 404  | Not Found - Resource doesn't exist   |
| 409  | Conflict - Resource already exists   |
| 500  | Internal Server Error                |

## Authentication

The API uses a two-tier JWT-based authentication system:

1. **Long Tokens**:

    - Issued during login/registration
    - Valid for 3 years
    - Used for long-term authentication
    - Required for creating short tokens

2. **Short Tokens**:
    - Created from long tokens
    - Valid for 1 year
    - Used for regular API access
    - Tied to specific devices/user-agents

Include the appropriate token in the Authorization header:

```http
Authorization: token <token>
```

## Role-Based Access

- **Superadmin**:

    - Full system access
    - Can manage all schools, classrooms, and students
    - Can manage users and their roles
    - Can perform all administrative actions

- **School Admin**:

    - Access limited to assigned school resources
    - Can manage classrooms and students within their school
    - Cannot create/delete schools or manage other school admins

- **User**:
    - Basic access level
    - Can view their own user information
    - Cannot perform administrative actions

## Deployment

### Production Deployment

1. Build the Docker image:

```bash
docker build -t school-management-api .
```

2. Push to container registry:

```bash
docker tag school-management-api your-registry/school-management-api
docker push your-registry/school-management-api
```

3. Deploy using Docker Compose:

```bash
docker-compose -f docker-compose.yml up -d
```

### Environment Variables

| Variable             | Description                          | Default                |
| -------------------- | ------------------------------------ | ---------------------- |
| `SERVICE_NAME`       | Service identifier                   | school_management      |
| `NODE_ENV`           | Environment (development/production) | development            |
| `USER_PORT`          | API port                             | 5111                   |
| `REDIS_URI`          | Redis connection URI                 | redis://localhost:6379 |
| `LONG_TOKEN_SECRET`  | JWT secret for long tokens           | -                      |
| `SHORT_TOKEN_SECRET` | JWT secret for short tokens          | -                      |
| `NACL_SECRET`        | Additional encryption secret         | -                      |
| `OYSTER_REDIS`       | Oyster DB Redis URI                  | redis://localhost:6379 |
| `OYSTER_PREFIX`      | Oyster DB key prefix                 | school\_               |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

ISC License

## Development Assumptions

1. **Data Storage**

    - Redis is sufficient for the scale of operations
    - Data consistency is maintained through atomic operations
    - Relationships are managed through Redis sets

2. **Authentication**

    - Users primarily access from web browsers
    - Long tokens are stored securely by clients
    - Device-specific short tokens enhance security

3. **Business Rules**

    - A student belongs to only one classroom at a time
    - A classroom belongs to only one school
    - School admins manage only their assigned schools
    - Resources are simple string identifiers

4. **Performance**

    - Rate limiting is sufficient at 100 requests per minute
    - Redis can handle the expected load
    - Network latency is not a major concern

5. **Security**

    - All communication is over HTTPS
    - Passwords are properly hashed
    - Tokens are securely stored
    - Input is properly sanitized

6. **Scalability**
    - Horizontal scaling is possible
    - Redis cluster can be implemented if needed
    - Stateless design allows for load balancing
