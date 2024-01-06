# Final Project B11

## Description

MOOC (Massive Open Online Course) app is a versatile online learning platform that offers open and extensive access to a diverse range of courses. Users can choose from high-quality courses taught by expert instructors from top educational institutions worldwide. The app provides flexible, affordable, and accessible learning experiences, allowing users to study at their own pace and convenience.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [API Documentation](#api-documentation)
- [API Endpoints](#api-endpoints)

## Authors

- Arfin Dwi Octavianto
- Moh Hafid Nur Firmansyah
- Shera Alice Ayutri
- Muhammad Afif Mu'tashim

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/your-username/final-project-b11.git

   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up environment variables:

   Create a .env file in the root directory and add the necessary variables. Refer to the .env.example file for guidance.

4. Set up prisma:

   ```bash
   npx prisma migrate dev --name init
   ```

## Usage

For development with auto-restart (nodemon):

```bash
npm run dev
```

## API Documentation

Swagger Documentation
Access the Swagger documentation at `/api-docs` after starting the server.

## API Endpoints

- Users: `/api/v1/users`
- User Profiles: `/api/v1/user-profiles`
- Categories: `/api/v1/categories`
- Courses: `/api/v1/courses`
- Chapters: `/api/v1/chapters`
- Lessons: `/api/v1/lessons`
- Enrollments: `/api/v1/enrollments`
- Promotions: `/api/v1/promotions`
- Payments: `/api/v1/payments`
- Notifications: `/api/v1/notifications`
- Trackings: `/api/v1/trackings`
- Reviews: `/api/v1/reviews`
- Admin: `/api/v1/admin`
