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

  login(user: any, authHeader: string): Promise<SignupResponse> {
    return this.fusionAuthService
      .login(user, authHeader)
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

  async fetchUsers(applicationId: string, startRow?: number, numberOfResults?: number, authHeader?: string): Promise<UsersResponse> {
    const { total, users }: { total: number; users: Array<User> } =
      await this.fusionAuthService.getUsers(
        applicationId,
        startRow,
        numberOfResults,
        authHeader,
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

  async updatePassword(data: {loginId: string, password: string}, applicationId: string, authHeader?: string): Promise<any> {
    return this.fusionAuthService.upddatePasswordWithLoginId(data, applicationId, authHeader);
}

async createUser(data: UserRegistration, applicationId: string, authHeader?: string): Promise<SignupResponse> {
    const { userId, user, err }: { userId: UUID; user: User; err: Error } =
      await this.fusionAuthService.createAndRegisterUser(data, applicationId , authHeader);
    if (userId == null || user == null) {
      throw new HttpException(err, HttpStatus.BAD_REQUEST);
    }
    const response: SignupResponse = new SignupResponse().init(uuidv4());
    response.result = user;
    return response;
  }

  async updateUser(userId: string, data: User, applicationId: string, authHeader?: string): Promise<any> {
    const { _userId, user, err }: { _userId: UUID; user: User; err: Error } =
      await this.fusionAuthService.updateUser(userId, {user: data}, applicationId, authHeader);
    if (_userId == null || user == null) {
      throw new HttpException(err, HttpStatus.BAD_REQUEST);
    }
    const response: SignupResponse = new SignupResponse().init(uuidv4());
    response.result = user;
    return response;
  }

  async fetchUsersByString(
    queryString: string,
    startRow: number,
    numberOfResults: number,
    applicationId: string,
    authHeader?: string
  ): Promise<UsersResponse> {
    const { total, users }: { total: number; users: Array<User> } =
      await this.fusionAuthService.getUsersByString(
        queryString,
        startRow,
        numberOfResults,
        applicationId,
        authHeader
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