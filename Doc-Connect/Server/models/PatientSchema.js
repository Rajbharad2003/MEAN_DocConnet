const mongoose = require("mongoose");

const PatientSchema = new mongoose.Schema({
        Email : {
            type : String,
            required : true,
            unique : true 
        },
        Password : {
            type :  Buffer,
            required : true,
            unique : true
        },
        Name : {
            type : String,
            required : true
        },
        Age : {
            type : Number,
            required : true,
        },
        DoB: {
            type: Date,
            required: [true, " Please add your birthdate. "]
        },
        Profile_picture: {
            type: String,
        },
        Gender: {
            type: String,
            required: [true, " Please add mention your Gender. "]
        },
        Phone_no : {
            type : Number,
            required : true
        },
        Blood_group : {
            type: String
        },
        Appointment_id : {
            type : [mongoose.Schema.Types.ObjectId],
            ref : "Appointment",
        },
        Salt: Buffer
    },
    {
        timestamps : true,
    }
);

module.exports = mongoose.model("Patient",PatientSchema);