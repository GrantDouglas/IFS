var path = require('path');
var viewPath = path.join( __dirname + "/");
var fs = require("fs");
var _ = require('lodash');
var async = require('async');

var Errors = require(__components + "Errors/errors");
var Logger = require( __configs + "loggingConfig");

var db = require( __configs + 'database');
var config = require(__configs + 'databaseConfig');
var dbHelpers = require(__components + "Databases/dbHelpers");

var studentProfile = require(__components + "StudentProfile/studentProfileDB");
var upcomingEvents = require(__components + "StudentProfile/upcomingEventsDB");
var studentSkill = require(__components + "StudentProfile/studentSkillDB");

module.exports = function(app, iosocket) {

    app.get('/studentSkills', function(req,res) {
        // Get the class skills
        // Get student and class Skill;
        // getStudentClassSkills
        var userId = req.user.id;
        studentSkill.getUserSkills( userId, function( errUserSkills, userSkills ) {
            studentSkill.getStudentClassSkills( userId, function( err,classSkills ) {
                classSkills = _.differenceBy(classSkills,userSkills,'classSkillId');
                var page = {
                    'title': "Student Skill Set",
                    'userRatedSkills': userSkills,
                    'classSkills': classSkills
                };
                res.render( viewPath + "studentSkill", page );
            });
        });
    });

    app.post('/studentSkills', function(req,res) {

        studentProfile.getStudentProfile(req.user.id, function(err, profileData) {
            console.log("HERE******************************", profileData);
            if( profileData && profileData.length > 0) {
                var studentId = profileData[0].id;
                console.log(studentId);
                console.log("*************************************8STUDENT SKILL VALUES", req.body);
                var skills = req.body;

                var userKey = 'userRatedSkills';
                var classKey = 'classSkills';
                var idx = -1;

                async.eachOf(skills, function( value,key, callback ) {

                        if( value[1] == 'yes' ) {
                            var m = key.toString().match( /[a-zA-Z]*(\d*)/);
                            if( m && m.length > 1 ) {
                                idx = parseInt(m[1]);
                                if( _.startsWith(key, userKey) )
                                    studentSkill.setStudentSkills(studentId, idx, parseInt(value[0])/100, callback);
                                else if( _.startsWith(key, classKey) )
                                    studentSkill.insertStudentSkills( studentId, idx, parseInt(value[0])/100, callback );
                            }
                        }
                    }, function(err){
                        if(err)
                            Logger.error(err);
                        else
                            Logger.log("Finished setting up.");
                    }
                );
            }

            res.location('/dashboard');
            res.redirect("/dashboard");
        });
    });
}
