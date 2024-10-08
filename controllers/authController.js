const { promisify } = require('util');
const User = require("../models/userModel");
const catchAsync = require("../utils/catchAsync");
const jwt = require('jsonwebtoken');
const AppError = require('../utils/appError');
const Email = require('../utils/email');
const crypto = require('crypto');

const signToken = id => {
    return jwt.sign({ id : id },process.env.JWT_SECRET,{
        expiresIn : process.env.JWT_EXPIRES_IN
    })
}

const createSendToken = (user , statusCode ,res)=>{
    const token = signToken(user._id);

    const cookieOptions = {
        expires : new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000),
        httpOnly : true
    };

    if(process.env.NODE_ENV === 'production') cookieOptions.secure = 'true';

    res.cookie('jwt', token, cookieOptions);

    // Remove password from response
    user.password = undefined;

    res.status(statusCode).json({
        status : "success",
        token,
        data : {
            user 
        }
    });
}

exports.signup = catchAsync( async (req,res,next) => {
    // const newUser = await User.create(req.body); //User.save
    const newUser = await User.create(req.body);

    // console.log(process.env.JWT_EXPIRES_IN);
    const url = `${req.protocol}://${req.get('host')}/me` ;
    console.log(url);
    await new Email(newUser, url).sendWelcome();

    createSendToken(newUser,201,res);

});


exports.login = catchAsync( async (req,res,next) => {
    const { email , password } = req.body ;

    // 1) Check if the email & password exists
    if(!email || !password){
        return next(new AppError("Please provide email and password",400))
    }

    // 2) Check if user exists & password is correct
    const user = await User.findOne({email : email}).select('+password'); 

    if(!user || !(await user.correctPassword(password,user.password)) ){
        return next(new AppError("Incorrect email or password!",401));
    }

    // 3) If everything is ok , send token to client
    createSendToken(user,200,res);

});

exports.logout = (req,res) => {
    res.cookie('jwt','loggedout', {
        expires : new Date(Date.now() + 10 * 1000),
        httpOnly : true
    });

    res.status(200).json({
        status : 'success'
    })
};

exports.protect = catchAsync(async (req,res,next)=>{
    let token;

    // 1) Getting token & check if it's there
    if(req.headers.authorization && req.headers.authorization.startsWith('Bearer'))
    {
        token = req.headers.authorization.split(' ')[1];
    
    }else if(req.cookies.jwt){
        
        token = req.cookies.jwt;
    }

    // console.log(token);

    if(!token){
        return next(new AppError('You are not logged In ! Please log In to get access',401));
    }

    // 2) Verfication token
    const decoded = await promisify(jwt.verify)(token,process.env.JWT_SECRET);
    console.log(decoded);

    // 3) Check if user still exists
    const freshUser = await User.findById(decoded.id);
    if(!freshUser){
        return next(new AppError('The user belonging to this token no longer exists!',401));
    }

    // 4) Check if user changed password after the token was issued 
    if(freshUser.changedPasswordAfter(decoded.iat)){
        return next(new AppError("User recently Changed password ! Please log in again.",401));
    };

    //GRANT ACCESS TO USER AND TO THE PUG FILES
    req.user = freshUser ;
    res.locals.user = freshUser;

    next();
});

// Only for rendered pages , no errors !
exports.isLoggedIn = async (req, res, next) => {
    
    // 1) Getting token & check if it's there
    if (req.cookies.jwt) {
        try{
            // 2) Verfication token
            const decoded = await promisify(jwt.verify)(
              req.cookies.jwt,
              process.env.JWT_SECRET
            );
            // console.log(decoded);
        
            // 3) Check if user still exists
            const freshUser = await User.findById(decoded.id);
            if (!freshUser) {
              return next();
            }
        
            // 4) Check if user changed password after the token was issued
            if (freshUser.changedPasswordAfter(decoded.iat)) {
              return next();
            }
        
            // There is a logged in user
            res.locals.user = freshUser;
            return next();
        }catch(err){
            return next();
        }
    }
    next();
};


exports.restrictTo = (...roles) => {
    return (req , res , next) => {
        // roles : ['admin','lead-guide'] , req.user.role = 'user'
        if(!roles.includes(req.user.role)){
            return next(new AppError("You do not have the permission to perform this action ",403));
        }
        
        next();
    }
}

exports.forgotPassword = catchAsync(async (req,res,next) => {

    // 1) Get user based on the Posted email
    const user = await User.findOne({ email : req.body.email });
    if(!user){
        return next(new AppError("There is no user with this email address ",404))
    }

    // 2) Generate the random reset token
    const resetToken = user.createPasswordResetToken();
    await user.save({validateBeforeSave : false});

    // 3) Send it to the user's email address 
    
    // const message = `Forgot your password ? Submit a patch request with your new Password and 
    // PasswordConfirm to ${resetURL}. \n If you didn't forget Password , Please ignore this email !`
    
    try {
        //   await sendEmail({
            //     email: user.email,
            //     subject: 'Your password reset token (valid for 10 min)',
            //     message,
            //   });
            
      const resetURL = `${req.protocol}://${req.get('host')}/api/v1/users/resetPassword/${resetToken}`;
      await new Email(user, resetURL).sendPasswordReset();

      res.status(200).json({
        status: 'success',
        message: 'Token sent to email!',
      });
      
    } catch (err) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({validateBeforeSave : false})

      return next(
        new AppError(
          'There was an error sending the email. Please try again later!',
          500
        )
      );
    }
});


exports.resetPassword = catchAsync(async (req,res,next) => {

    // 1) Get user based on the token
    const hashedToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');
      
      const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() },
      });

    // 2) If token has not expired, and there is user, set the password
    if(!user){
        return next(new AppError("Token is invalid or has expired !", 400));
    }

    user.password = req.body.password ;
    user.confirmPassword = req.body.confirmPassword;
    user.passwordResetToken = undefined ;
    user.passwordResetExpires = undefined ;
    await user.save();

    // 3) Update changePasswordAt property for the user 

    // 4) Log the user in, send JWT 
    createSendToken(user,200,res);
})



exports.updatePassword = catchAsync(async (req,res,next)=>{
    // 1) Get user from collection
    const user = await User.findById(req.user.id).select("+password");
    
    // 2) Check if posted password is correct
    if(!(await user.correctPassword(req.body.passwordCurrent , user.password))){
        return next(new AppError("Your current Password is wrong !",401));
    }

    // 3) If so , update password 
    user.password = req.body.password ;
    user.confirmPassword = req.body.passwordConfirm ;
    await user.save();
    // User.findByIdAndUpdate will not work as intended !

    // 4) Log user in , send jwt
    createSendToken(user , 200 , res);   
})

