# School Management System API

A comprehensive school management system built with Node.js, Express, and Redis.

## Features

- Role-based access control (RBAC)
- JWT-based authentication
- Rate limiting
- Redis for data persistence
- Comprehensive input validation
- Error handling with appropriate HTTP status codes

## System Architecture

The system follows a modular architecture with the following components:

- Managers: Business logic implementation
- Middleware: Request processing and validation
- Schema: Data validation rules
- Redis: Data persistence

## Authentication & Authorization

The system uses JWT tokens with two types:

- Long tokens: For long-term authentication
- Short tokens: For session-based authentication

### Roles

- Superadmin: Full system access
- School Admin: School-specific access
- User: Basic access

## API Endpoints

### Authentication

#### Register User

- **POST** `/api/user/registerUser`
- **Body**:
    ```json
    {
        "username": "string",
        "email": "string",
        "password": "string",
        "role": "string"
    }
    ```
- **Response**: User object with long token

#### Login

- **POST** `/api/user/loginUser`
- **Body**:
    ```json
    {
        "email": "string",
        "password": "string"
    }
    ```
- **Response**: User object with long token

### Schools

#### Create School (Superadmin only)

- **POST** `/api/school/createSchool`
- **Headers**: `token: <jwt_token>`
- **Body**:
    ```json
    {
        "name": "string",
        "address": "string",
        "phone": "string",
        "email": "string"
    }
    ```

#### Update School (Superadmin only)

- **PUT** `/api/school/updateSchool`
- **Headers**: `token: <jwt_token>`
- **Body**:
    ```json
    {
        "id": "string",
        "name": "string",
        "address": "string",
        "phone": "string",
        "email": "string"
    }
    ```

#### Delete School (Superadmin only)

- **DELETE** `/api/school/deleteSchool`
- **Headers**: `token: <jwt_token>`
- **Body**:
    ```json
    {
        "id": "string"
    }
    ```

#### Get School

- **GET** `/api/school/getSchool`
- **Headers**: `token: <jwt_token>`
- **Query**: `id=<school_id>`

#### List Schools

- **GET** `/api/school/listSchools`
- **Headers**: `token: <jwt_token>`

### Classrooms

#### Create Classroom (School Admin only)

- **POST** `/api/classroom/createClassroom`
- **Headers**: `token: <jwt_token>`
- **Body**:
    ```json
    {
        "name": "string",
        "capacity": "number",
        "grade": "string",
        "section": "string",
        "academicYear": "string",
        "schoolId": "string"
    }
    ```

#### Update Classroom (School Admin only)

- **PUT** `/api/classroom/updateClassroom`
- **Headers**: `token: <jwt_token>`
- **Body**:
    ```json
    {
        "id": "string",
        "name": "string",
        "capacity": "number",
        "grade": "string",
        "section": "string",
        "academicYear": "string"
    }
    ```

#### Delete Classroom (School Admin only)

- **DELETE** `/api/classroom/deleteClassroom`
- **Headers**: `token: <jwt_token>`
- **Body**:
    ```json
    {
        "id": "string"
    }
    ```

#### Get Classroom

- **GET** `/api/classroom/getClassroom`
- **Headers**: `token: <jwt_token>`
- **Query**: `id=<classroom_id>`

#### List School Classrooms

- **GET** `/api/classroom/listSchoolClassrooms`
- **Headers**: `token: <jwt_token>`
- **Query**: `schoolId=<school_id>`

### Students

#### Create Student (School Admin only)

- **POST** `/api/student/createStudent`
- **Headers**: `token: <jwt_token>`
- **Body**:
    ```json
    {
        "name": "string",
        "dateOfBirth": "YYYY-MM-DD",
        "gender": "string",
        "parentName": "string",
        "parentPhone": "string",
        "email": "string",
        "enrollmentDate": "YYYY-MM-DD",
        "bloodGroup": "string",
        "emergencyContact": "string",
        "medicalConditions": ["string"],
        "classroomId": "string",
        "schoolId": "string"
    }
    ```

#### Update Student (School Admin only)

- **PUT** `/api/student/updateStudent`
- **Headers**: `token: <jwt_token>`
- **Body**:
    ```json
    {
        "id": "string",
        "name": "string",
        "dateOfBirth": "YYYY-MM-DD",
        "gender": "string",
        "parentName": "string",
        "parentPhone": "string",
        "email": "string",
        "bloodGroup": "string",
        "emergencyContact": "string",
        "medicalConditions": ["string"]
    }
    ```

#### Delete Student (School Admin only)

- **DELETE** `/api/student/deleteStudent`
- **Headers**: `token: <jwt_token>`
- **Body**:
    ```json
    {
        "id": "string"
    }
    ```

#### Get Student

- **GET** `/api/student/getStudent`
- **Headers**: `token: <jwt_token>`
- **Query**: `id=<student_id>`

#### List Classroom Students

- **GET** `/api/student/listClassroomStudents`
- **Headers**: `token: <jwt_token>`
- **Query**: `classroomId=<classroom_id>`

#### List School Students

- **GET** `/api/student/listSchoolStudents`
- **Headers**: `token: <jwt_token>`
- **Query**: `schoolId=<school_id>`

#### Transfer Student (School Admin only)

- **POST** `/api/student/transferStudent`
- **Headers**: `token: <jwt_token>`
- **Body**:
    ```json
    {
        "studentId": "string",
        "newClassroomId": "string"
    }
    ```

## Error Handling

All API endpoints follow a consistent error response format:

```json
{
  "ok": false,
  "code": <http_status_code>,
  "message": "Error description",
  "errors": ["Detailed error messages"]
}
```

Common HTTP status codes:

- 200: Success
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 409: Conflict
- 429: Too Many Requests
- 500: Internal Server Error

## Rate Limiting

The API implements rate limiting with the following defaults:

- 100 requests per minute per IP
- Headers included in response:
    - X-RateLimit-Limit
    - X-RateLimit-Remaining

## Setup Instructions

1. Clone the repository
2. Install dependencies:
    ```bash
    npm install
    ```
3. Create `.env` file with required environment variables:
    ```
    SERVICE_NAME=school_management
    ENV=development
    USER_PORT=5111
    REDIS_URI=redis://localhost:6379
    LONG_TOKEN_SECRET=your_long_token_secret
    SHORT_TOKEN_SECRET=your_short_token_secret
    ```
4. Start Redis server
5. Run the application:
    ```bash
    node index.js
    ```

## Database Schema

### Redis Data Structure

The system uses Redis for data persistence with the following key patterns:

1. Blocks (Main Data):

- `user:<email>` - User data
- `school:<id>` - School data
- `classroom:<id>` - Classroom data
- `student:<id>` - Student data

2. Relations:

- `school:<id>/_admins` - School administrators
- `school:<id>/_classrooms` - School's classrooms
- `classroom:<id>/_students` - Classroom's students
- `school:<id>/_students` - School's students

3. Rate Limiting:

- `rateLimit:<ip>` - Rate limiting counters

## Security Considerations

1. Authentication:

    - JWT-based token system
    - Password hashing using bcrypt
    - Token expiration

2. Authorization:

    - Role-based access control
    - Resource-level permissions
    - School-specific access control

3. Input Validation:

    - Schema-based validation
    - Data sanitization
    - Type checking

4. Rate Limiting:
    - IP-based rate limiting
    - Configurable limits
    - Redis-backed tracking

## Performance Considerations

1. Caching:

    - Redis for data storage
    - Relation-based queries
    - Efficient data structures

2. Scalability:

    - Modular architecture
    - Stateless API design
    - Redis for session management

3. Error Handling:
    - Graceful degradation
    - Comprehensive error messages
    - Proper status codes
