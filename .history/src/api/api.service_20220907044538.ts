import { LoginResponse, User, UUID, Error } from '@fusionauth/typescript-client';
import ClientResponse from '@fusionauth/typescript-client/build/src/ClientResponse';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ResponseCode, ResponseStatus, SignupResponse, UsersResponse, UserRegistration } from './api.interface';
import { FusionauthService } from './fusionauth/fusionauth.service';
import { OtpService } from './otp/otp.service';
import { v4 as uuidv4 } from 'uuid';
import { ConfigResolverService } from './config.resolver.service';
const CryptoJS = require('crypto-js');
const AES = require('crypto-js/aes');

CryptoJS.lib.WordArray.words;

@Injectable()
export class ApiService {
  encodedBase64Key = process.env.ENCRYPTION_KEY;
  parsedBase64Key =
    this.encodedBase64Key === undefined
      ? 'bla'
      : CryptoJS.enc.Base64.parse(this.encodedBase64Key);
  constructor(
    private configService: ConfigService,
    private readonly fusionAuthService: FusionauthService,
    private readonly otpService: OtpService,
    private readonly configResolverService: ConfigResolverService,
  ) {
    this.encodedBase64Key = this.configService.get<string>('ENCRYPTION_KEY');
    this.parsedBase64Key =
      this.encodedBase64Key === undefined
        ? 'bla'
        : CryptoJS.enc.Base64.parse(this.encodedBase64Key);
  }

  login(user: any): Promise<SignupResponse> {
    return this.fusionAuthService
      .login(user)
      .then(async (resp: ClientResponse<LoginResponse>) => {
        let fusionAuthUser: any = resp.response;
        if (fusionAuthUser.user === undefined) {
          console.log('Here');
          fusionAuthUser = fusionAuthUser.loginResponse.successResponse;
        }
        if (fusionAuthUser.user.data.accountName === undefined) {
          if (fusionAuthUser.user.fullName == undefined) {
            if (fusionAuthUser.user.firstName === undefined) {
              fusionAuthUser['user']['data']['accountName'] = this.decrypt(
                user.loginId,
              );
            } else {
              fusionAuthUser['user']['data']['accountName'] =
                fusionAuthUser.user.firstName;
            }
          } else {
            fusionAuthUser['user']['data']['accountName'] =
              fusionAuthUser.user.fullName;
          }
        }
        const response: SignupResponse = new SignupResponse().init(uuidv4());
        response.responseCode = ResponseCode.OK;
        response.result = {
          responseMsg: 'Successful Logged In',
          accountStatus: null,
          data: {
            user: fusionAuthUser,
            schoolResponse: null,
          },
        };
        return response;
      })
      .catch((errorResponse: ClientResponse<LoginResponse>): SignupResponse => {
        console.log(errorResponse);
        const response: SignupResponse = new SignupResponse().init(uuidv4());
        if (errorResponse.statusCode === 404) {
          response.responseCode = ResponseCode.FAILURE;
          response.params.err = 'INVALID_USERNAME_PASSWORD';
          response.params.errMsg = 'Invalid Username/Password';
          response.params.status = ResponseStatus.failure;
        } else {
          response.responseCode = ResponseCode.FAILURE;
          response.params.err = 'UNCAUGHT_EXCEPTION';
          response.params.errMsg = 'Server Failure';
          response.params.status = ResponseStatus.failure;
        }
        return response;
      });
  }

  async fetchUsers(req: any): Promise<UsersResponse> {
    const { total, users }: { total: number; users: Array<User> } =
      await this.fusionAuthService.getUsers(
        req.applicationId,
        req.startRow,
        req.numberOfResults,
        req.authHeader,
      );
    const response: UsersResponse = new UsersResponse().init(uuidv4());
    if (users != null) {
      response.responseCode = ResponseCode.OK;
      response.params.status = ResponseStatus.success;
      response.result = { total, users };
    } else {
      response.responseCode = ResponseCode.FAILURE;
      response.params.status = ResponseStatus.failure;
      response.params.errMsg = 'No users found';
      response.params.err = 'NO_USERS_FOUND';
    }
    return response;
  }

  async updatePassword(data: {loginId: string, password: string, applicationId: string, authHeader?: string}): Promise<any> {
    return this.fusionAuthService.upddatePasswordWithLoginId(data);
}

async createUser(data: UserRegistration): Promise<SignupResponse> {
    const { userId, user, err }: { userId: UUID; user: User; err: Error } =
      await this.fusionAuthService.createAndRegisterUser(data, data.registration.applicationId , data['authHeader']);
    if (userId == null || user == null) {
      throw new HttpException(err, HttpStatus.BAD_REQUEST);
    }
    const response: SignupResponse = new SignupResponse().init(uuidv4());
    response.result = user;
    return response;
  }

  encrypt(plainString: any): any {
    const encryptedString = AES.encrypt(plainString, this.parsedBase64Key, {
      mode: CryptoJS.mode.ECB,
    }).toString();
    return encryptedString;
  }

  decrypt(encryptedString: any): any {
    const plainString = AES.decrypt(encryptedString, this.parsedBase64Key, {
      mode: CryptoJS.mode.ECB,
    }).toString(CryptoJS.enc.Utf8);
    return plainString;
  }
}
