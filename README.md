# University Forms Platform

A forms platform built for academic institutions with secure authentication and response collection.

## Current Features
- User registration & login
- Create and manage forms
- Collect form responses
- View response analytics

## Tech Stack
- **Backend:** Node.js + Express
- **Database:** Oracle SQL
- **Frontend:** Vanilla JS/HTML/TailwindCSS
- **Authentication:** JWT

## Database Schema
- Users (email, password, role: professor/student)
- Forms (formId, createdBy, title, questions)
- Responses (responseId, formId, userId, data)

## How to Run Locally
1. Clone this repo
2. npm install
3. Set up database connection
4. npm start

## TODO (Upcoming)
- [ ] JWT authentication
- [ ] Rate limiting
- [ ] Data encryption
- [ ] Gemini AI integration
- [ ] Response analytics

## Deployed at
[in progress]