/**
 * @file verifySend.js
 * @author Keefer Rourke
 * @brief this file contains methods pertaining to confirming actions via
 *        emailed links
 **/

var Logger = require(__configs + 'loggingConfig');

var tokgen = require('tokgen');
var nodemailer = require('nodemailer');
var mailcfg = require(__configs + 'mailConfig');

var dbcfg = require(__configs + 'databaseConfig');
var db = require(__configs + 'database');
var dbHelpers = require(__components + "Databases/dbHelpers");

module.exports = {
    /**
     * This function generates a verification link for a given route, but does
     * not replace tokens.
     * @param route: the route this link should operate on (Ex. 'verify')
     * @param uid: the id of the user for the link
     * @param callback: a function which takes an error string and return data
     *                  as parameters (Ex. callback(error, myData);)
     **/
    generateLink: function(route, uid, callback) {
        var generator = new tokgen();
        var token = generator.generate();
        // double check if the user already has a token
        var q = dbHelpers.buildSelect(dbcfg.verify_table) + dbHelpers.buildWhere(['userId', 'type']);
        db.query(q, [uid, route], function(qErr, qRet) {
            if (qErr) {
                callback(qErr, null);
            } else { // query was successful
                if (qRet[0]) {
                    var error = "Token exists, user generateLinkReplTok if the token in the database should be replaced.";
                    callback(error, null);
                } else {
                    // now insert the link into the database
                    var insert = dbHelpers.buildInsert(dbcfg.verify_table) + dbHelpers.buildValues(['userId', 'type', 'token']);
                    db.query(insert, [uid, route, token], function(insErr, insRet) {
                        if (insErr) {
                            callback(insErr, null);
                        } else { //query was successful
                            var link = 'http://' + mailcfg.host + '/' + route + '?id=' + uid + '&t=' + token;
                            callback(null, link); // return
                        }
                    });
                }
            }
        });
    },

    /**
     * This function generates a verification link for a given route and
     * allows token replacement.
     * @param route: the route this link should operate on (Ex. 'verify')
     * @param uid: the id of the user for the link
     * @param callback: a function which takes an error string and return data
     *                  as parameters (Ex. callback(error, myData);)
     **/
    generateLinkReplTok: function(route, uid, callback) {
        var generator = new tokgen();
        var token = generator.generate();
        var link = 'http://' + mailcfg.host + '/' + route + '?id=' + uid + '&t=' + token;
        // double check if the user already has a token
        var q = dbHelpers.buildSelect(dbcfg.verify_table) + dbHelpers.buildWhere(['userId', 'type']);
        db.query(q, [uid, route], function(qErr, qRet) {
            if (qErr) {
                callback(qErr, null);
            } else { // query was successful
                if (qRet[0]) { // if there is already an entry, update the token
                    var update = dbHelpers.buildUpdate(dbcfg.verify_table) + ' SET token = ? ' + dbHelpers.buildWhere(['userId', 'type']);
                    db.query(update, [token, uid, route], function(updateErr, updateRet) {
                        if (updateErr) {
                            console.log("ERROR", updateErr);
                            callback(updateErr, null);
                        } else { // query was successful
                            callback(null, link); // return
                        }
                    });
                } else { // insert the new link to the database
                    // now insert the link into the database
                    var insert = dbHelpers.buildInsert(dbcfg.verify_table) + dbHelpers.buildValues(['userId', 'type', 'token']);
                    db.query(insert, [uid, route, token], function(insErr, insRet) {
                        if (insErr) {
                            console.log("ERROR", insErr);
                            callback(insErr, null);
                        } else { //query was successful
                            callback(null, link); // return
                        }
                    });
                }
            }
        });
    },

    /**
     * This function sends a verification link to a user.
     * @param email: the destination address
     * @param link: the link to be sent
     * @param subject: the subject of the email
     * @param message: the message body
     * @return true is successful, false if unsuccessful
     * @note the message will look like the following:
     * ```
     * Hello First Last,
     *
     * Message body
     * <link>
     *
     * This message was automatically generated by the Immediate Feedback
     * System at <host>. Please do not reply to this message.
     * ```
     **/
    sendLink: function(email, link, subject, message) {
        var transporter = new nodemailer.createTransport(mailcfg.transport_cfg);
        var msg = mailcfg.message;
        // lookup uid
        var lookupId = dbHelpers.buildSelect(dbcfg.users_table) + dbHelpers.buildWhere(['username']);
        db.query(lookupId, [email], function(errId, retId) {
            if (errId) {
                Logger.error(errId);
                return false;
            } else {
                var uid = retId[0].id;
                // lookup name
                var lookupName = dbHelpers.buildSelect(dbcfg.student_table) + dbHelpers.buildWhere(['userId']);
                db.query(lookupName, [uid], function(errName, retName) {
                    if (errName) {
                        Logger.error(errName);
                        return false;
                    } else {
                        console.log("DATA", retName);
                        var name = retName[0].name;
                        // message footer
                        var footer = 'This message was automatically generated by the Immediate Feedback System at ' + mailcfg.host + '. Please do not reply to this message.\n';
                        var htmlfooter = 'This message was automatically generated by the Immediate Feedback System at <a href="'+ mailcfg.host + '">' + mailcfg.host + '</a>. Please do not reply to this message.<br/>'

                        // build message body
                        var plainbody = 'Hello ' + name + ',\n\n';
                        plainbody += message + '\n';
                        var htmlbody = plainbody.replace(/\n/g, "<br/>");
                        plainbody += link + '\n\n';
                        plainbody += footer;
                        htmlbody += '<a href="' + link + '">' + link + '</a><br/><br/>';
                        htmlbody += htmlfooter;

                        msg['to'] = email;
                        msg['subject'] = subject;
                        msg['text'] = plainbody;
                        msg['html'] = htmlbody;

                        transporter.sendMail(msg, (error, info) => {
                            if (error) {
                                Logger.error(error);
                                return false;
                            } else {
                                Logger.info('Message %s sent: %s', info.messageId, info.response);
                                return true;
                            }
                        });
                    }
                });
            }
        });
    }
}